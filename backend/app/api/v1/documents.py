"""
Documents API endpoints.

Provides CRUD operations for documents within collections.
"""

import hashlib
import logging
import os
import tempfile
from typing import Protocol, cast
from uuid import UUID

from fastapi import (
    APIRouter,
    File,
    HTTPException,
    Request,
    UploadFile,
    status,
)
from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain_core.documents import Document as LangchainDocument
from langchain_text_splitters import RecursiveCharacterTextSplitter

from app.api.deps import (
    CollectionRepo,
    DocumentRepo,
    SettingsRepo,
    require_collection,
    require_document,
)
from app.api.schemas import (
    DeletedResponse,
    DocumentChunkSchema,
    DocumentContentResponse,
    DocumentListResponse,
    DocumentResponse,
)
from app.db.models import Document
from app.services.retrieval import HybridSearchServiceDep, VectorStoreService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["documents"])

# Allowed file types
ALLOWED_EXTENSIONS = {".pdf", ".txt", ".md"}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB


class _VectorStoreProtocol(Protocol):
    def add_documents(self, documents: list[LangchainDocument]) -> None: ...
    def get_chunks_by_document(self, document_id: str) -> list[LangchainDocument]: ...
    def delete_by_document_id(self, document_id: str) -> int: ...


def validate_file(file: UploadFile) -> str:
    """Validate uploaded file and return extension."""
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Filename is required",
        )

    # Check extension
    ext = "." + file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type '{ext}' not allowed. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )
    return ext


def _build_chunks(
    pages: list[LangchainDocument],
    chunk_size: int,
    chunk_overlap: int,
    filename: str,
    document_id: UUID,
    collection_id: UUID,
    collection_name: str,
) -> list[LangchainDocument]:
    """Split pages into chunks and apply consistent metadata."""
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        add_start_index=True,
    )
    chunks = splitter.split_documents(pages)

    # Handle small documents: if no chunks but we have content, use original pages as chunks
    if not chunks and pages:
        total_content = "".join(page.page_content for page in pages).strip()
        if total_content:
            chunks = [LangchainDocument(
                page_content=total_content,
                metadata=pages[0].metadata if pages else {},
            )]
            logger.info(f"Small document - created 1 chunk from {len(total_content)} chars")

    # Apply consistent metadata
    total_chunks = len(chunks)
    for i, chunk in enumerate(chunks):
        chunk.metadata.update({
            "source": filename,
            "document_id": str(document_id),
            "collection_id": str(collection_id),
            "collection_name": collection_name,
            "chunk_index": i,
            "total_chunks": total_chunks,
        })

    return chunks


async def process_and_index_document(
    content: bytes,
    filename: str,
    extension: str,
    collection_id: UUID,
    collection_name: str,
    document_id: UUID,
    vector_store,
    document_repo: DocumentRepo,
    collection_repo: CollectionRepo,
    chunk_size: int,
    chunk_overlap: int,
) -> int:
    """
    Process document content and index into ChromaDB.

    Returns the number of chunks created.
    """
    temp_path = None

    try:
        # Write content to temp file
        with tempfile.NamedTemporaryFile(suffix=extension, delete=False) as tmp:
            tmp.write(content)
            temp_path = tmp.name

        # Load document based on type
        if extension == ".pdf":
            pages = PyPDFLoader(temp_path).load()
            page_count = len(pages)
        else:
            # .txt or .md
            pages = TextLoader(temp_path).load()
            page_count = 1

        # Split into chunks (consistent metadata, includes total_chunks)
        chunks = _build_chunks(
            pages=pages,
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            filename=filename,
            document_id=document_id,
            collection_id=collection_id,
            collection_name=collection_name,
        )

        # Handle empty documents
        if not chunks:
            logger.warning(f"Document {document_id} has no extractable content")
            await document_repo.update_status(
                document_id,
                status="error",
                error_message="Document has no extractable text content",
            )
            return 0

        # Index into ChromaDB
        vector_store_typed = cast(_VectorStoreProtocol, vector_store)
        vector_store_typed.add_documents(chunks)
        logger.info(f"Indexed {len(chunks)} chunks for document {document_id}")

        # Update document record with counts
        await document_repo.update_status(
            document_id,
            status="ready",
            page_count=page_count,
            chunk_count=len(chunks),
        )

        # Update collection counts
        await collection_repo.update_counts(collection_id)

        return len(chunks)

    except Exception as e:
        logger.error(f"Failed to process document {document_id}: {e}")
        await document_repo.update_status(document_id, status="error", error_message=str(e))
        raise

    finally:
        # Cleanup temp file
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)


async def stream_upload_to_temp(
    file: UploadFile,
    extension: str,
    max_size: int = MAX_FILE_SIZE,
    chunk_size: int = 64 * 1024,  # 64KB chunks
) -> tuple[str, int, str]:
    """
    Stream file upload to temp file to avoid memory issues.

    Returns:
        tuple of (temp_file_path, file_size, file_hash)

    Raises:
        HTTPException: If file is too large
    """
    hasher = hashlib.sha256()
    file_size = 0
    temp_path = None

    try:
        # Create temp file
        with tempfile.NamedTemporaryFile(suffix=extension, delete=False) as tmp:
            temp_path = tmp.name

            # Stream chunks to temp file
            while True:
                chunk = await file.read(chunk_size)
                if not chunk:
                    break

                file_size += len(chunk)

                # Check size limit during streaming
                if file_size > max_size:
                    # Clean up temp file
                    if temp_path and os.path.exists(temp_path):
                        os.remove(temp_path)
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"File too large. Maximum size is {max_size // (1024*1024)} MB",
                    )

                hasher.update(chunk)
                tmp.write(chunk)

        return temp_path, file_size, hasher.hexdigest()

    except HTTPException:
        raise
    except Exception as e:
        # Clean up on any error
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process upload: {str(e)}",
        )


@router.post(
    "/collections/{collection_id}/documents",
    response_model=DocumentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload a document",
    description="Upload a document to a collection for processing.",
)
async def upload_document(
    collection_id: UUID,
    request: Request,
    collection_repo: CollectionRepo,
    document_repo: DocumentRepo,
    settings_repo: SettingsRepo,
    vector_store: VectorStoreService,
    search_service: HybridSearchServiceDep,
    file: UploadFile = File(...),
) -> DocumentResponse:
    """Upload a document to a collection."""
    # Use DRY helper for 404 check
    collection = await require_collection(collection_id, collection_repo)

    # Get DB settings for chunk configuration
    db_settings = await settings_repo.get()

    # Validate file type
    extension = validate_file(file)

    # Check content-length header as early rejection (before any reading)
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            declared_size = int(content_length)
            if declared_size > MAX_FILE_SIZE:
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail=f"File too large. Maximum size is {MAX_FILE_SIZE // (1024*1024)} MB",
                )
        except ValueError:
            pass  # Invalid content-length header, will check actual size during streaming

    # Stream upload to temp file (memory efficient - only 64KB at a time)
    temp_path, file_size, file_hash = await stream_upload_to_temp(file, extension)

    try:
        # Check for duplicate
        if await document_repo.hash_exists(collection_id, file_hash):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This file has already been uploaded to this collection",
            )

        # Read content from temp file for processing
        with open(temp_path, "rb") as f:
            content = f.read()

        # Create document record
        document = Document(
            collection_id=collection_id,
            filename=file.filename or "unknown",
            file_hash=file_hash,
            file_size=file_size,
            status="processing",
        )
        document = await document_repo.create(document)

        logger.info(f"Uploaded document: {document.id} ({document.filename})")

        # Process and index document into ChromaDB
        try:
            chunk_count = await process_and_index_document(
                content=content,
                filename=file.filename or "unknown",
                extension=extension,
                collection_id=collection_id,
                collection_name=collection.name,
                document_id=document.id,
                vector_store=vector_store,
                document_repo=document_repo,
                collection_repo=collection_repo,
                chunk_size=db_settings.chunk_size,
                chunk_overlap=db_settings.chunk_overlap,
            )
            logger.info(f"Document {document.id} processed: {chunk_count} chunks indexed")

            # Invalidate BM25 cache so next search rebuilds with new docs
            search_service.invalidate_bm25_cache(str(collection_id))
            logger.info(f"Invalidated BM25 cache for collection {collection_id}")
        except Exception as e:
            logger.error(f"Document processing failed: {e}")
            # Document status already set to error in process_and_index_document

        # Refresh document to get updated status
        document_refreshed = await document_repo.get_by_id(document.id)
        if document_refreshed is not None:
            document = document_refreshed

        return DocumentResponse.from_model(document)

    finally:
        # Always clean up temp file
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)


@router.get(
    "/collections/{collection_id}/documents",
    response_model=DocumentListResponse,
    summary="List documents in a collection",
    description="List all documents in a collection.",
)
async def list_documents(
    collection_id: UUID,
    collection_repo: CollectionRepo,
    document_repo: DocumentRepo,
    skip: int = 0,
    limit: int = 100,
) -> DocumentListResponse:
    """List documents in a collection."""
    # Use DRY helper for 404 check
    await require_collection(collection_id, collection_repo)

    documents = await document_repo.get_by_collection(
        collection_id=collection_id,
        skip=skip,
        limit=limit,
    )
    total = await document_repo.count_by_collection(collection_id)

    return DocumentListResponse(
        data=[DocumentResponse.from_model(d) for d in documents],
        total=total,
    )


@router.get(
    "/documents/{document_id}",
    response_model=DocumentResponse,
    summary="Get a document",
    description="Retrieve a single document by ID.",
)
async def get_document(
    document_id: UUID,
    document_repo: DocumentRepo,
) -> DocumentResponse:
    """Get a document by ID."""
    # Use DRY helper for 404 check
    document = await require_document(document_id, document_repo)

    return DocumentResponse.from_model(document)


@router.get(
    "/documents/{document_id}/content",
    response_model=DocumentContentResponse,
    summary="Get document content",
    description="Retrieve all chunks/content for a document in order.",
)
async def get_document_content(
    document_id: UUID,
    document_repo: DocumentRepo,
    vector_store: VectorStoreService,
) -> DocumentContentResponse:
    """
    Get all chunks for a document.

    Returns the document's content as an ordered list of chunks,
    enabling full document viewing with chunk navigation.
    """
    # Use DRY helper for 404 check
    document = await require_document(document_id, document_repo)

    # Get chunks from vector store
    vector_store_typed = cast(_VectorStoreProtocol, vector_store)
    langchain_chunks = vector_store_typed.get_chunks_by_document(str(document_id))

    # Sort chunks by chunk_index
    sorted_chunks = sorted(
        langchain_chunks,
        key=lambda c: c.metadata.get("chunk_index", 0)
    )

    # Convert to response schema
    chunks = []
    for i, chunk in enumerate(sorted_chunks):
        metadata = chunk.metadata or {}
        chunks.append(DocumentChunkSchema(
            id=metadata.get("id", f"{document_id}-chunk-{i}"),
            content=chunk.page_content,
            chunk_index=metadata.get("chunk_index", i),
            page=metadata.get("page"),
            start_index=metadata.get("start_index"),
            metadata={k: v for k, v in metadata.items()
                     if k not in ["id", "chunk_index", "page", "start_index",
                                  "document_id", "collection_id", "collection_name", "source"]},
        ))

    logger.info(f"Retrieved {len(chunks)} chunks for document {document_id}")

    return DocumentContentResponse(
        document_id=document.id,
        filename=document.filename,
        collection_id=document.collection_id,
        total_chunks=len(chunks),
        chunks=chunks,
    )


@router.delete(
    "/documents/{document_id}",
    response_model=DeletedResponse,
    summary="Delete a document",
    description="Delete a document and its chunks from the vector store.",
)
async def delete_document(
    document_id: UUID,
    document_repo: DocumentRepo,
    collection_repo: CollectionRepo,
    vector_store: VectorStoreService,
    search_service: HybridSearchServiceDep,
) -> DeletedResponse:
    """Delete a document."""
    # Use DRY helper for 404 check
    document = await require_document(document_id, document_repo)

    collection_id = document.collection_id

    # Delete chunks from ChromaDB
    try:
        vector_store_typed = cast(_VectorStoreProtocol, vector_store)
        deleted_chunks = vector_store_typed.delete_by_document_id(str(document_id))
        logger.info(f"Deleted {deleted_chunks} chunks from ChromaDB for document {document_id}")
    except Exception as e:
        logger.warning(f"Failed to delete chunks from ChromaDB: {e}")
        # Continue with document deletion even if ChromaDB cleanup fails

    # Delete document from PostgreSQL
    await document_repo.delete(document)

    # Update collection counts
    await collection_repo.update_counts(collection_id)

    # Invalidate BM25 cache so next search rebuilds without deleted docs
    search_service.invalidate_bm25_cache(str(collection_id))
    logger.info(f"Invalidated BM25 cache for collection {collection_id}")

    logger.info(f"Deleted document: {document_id}")

    return DeletedResponse(id=document_id, object="document")
