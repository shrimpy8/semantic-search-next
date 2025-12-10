"""
Question Answering Chain Module

Handles retrieval-augmented generation (RAG) for answering questions based on documents.
"""

import logging
from collections.abc import Generator

from langchain_core.documents import Document
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.vectorstores import VectorStoreRetriever

from app.core.llm_factory import LLMFactory
from app.prompts import prompts

logger = logging.getLogger(__name__)


class QAChain:
    """
    Question-answering chain using retrieval-augmented generation.

    This class coordinates the RAG process:
    1. Retrieves relevant document chunks
    2. Formats context and question into a prompt
    3. Generates answer using LLM
    4. Streams the response token-by-token

    Supports multiple LLM providers through LLMFactory:
    - openai: GPT-4, GPT-4o-mini, etc.
    - anthropic: Claude models
    - ollama: Local models (Mistral, Llama3, etc.)

    Attributes:
        llm_model: LLM model for generation
        retriever: Vector store retriever for finding relevant chunks
        system_prompt: Template for QA system prompt

    Example:
        >>> qa = QAChain(
        ...     provider="openai",
        ...     model_name="gpt-4o-mini",
        ...     retriever=retriever,
        ... )
        >>> for chunk in qa.stream_answer("What is AI?", context):
        ...     print(chunk, end="")
    """

    def __init__(
        self,
        provider: str = "openai",
        model_name: str | None = None,
        temperature: float = 0.0,
        retriever: VectorStoreRetriever = None,
        system_prompt: str = None,
        prompt_key: str = "qa_system",
    ):
        """
        Initialize the QA chain.

        Args:
            provider: LLM provider (openai, anthropic, ollama)
            model_name: Name of model (defaults to provider's default)
            temperature: Model temperature (0.0 = deterministic)
            retriever: Vector store retriever instance
            system_prompt: System prompt template with {question} and {document} placeholders
                          (overrides prompt_key if provided)
            prompt_key: Key in prompts/qa.yaml to use (default: "qa_system")
                       Options: qa_system, qa_system_detailed, qa_system_concise, qa_system_technical
        """
        self.provider = provider
        self.model_name = model_name or LLMFactory.get_default_model(provider)
        self.temperature = temperature
        self.retriever = retriever

        # Initialize LLM using factory
        self.llm_model = LLMFactory.create(
            provider=provider,
            model=self.model_name,
            temperature=temperature,
        )
        logger.info(
            f"Initialized QAChain: provider={provider}, model={self.model_name}, temp={temperature}"
        )

        # Load system prompt from external file or use provided override
        if system_prompt:
            self.system_prompt = system_prompt
            logger.debug("Using provided system prompt override")
        else:
            try:
                self.system_prompt = prompts.get_raw("qa", prompt_key)
                logger.info(f"Loaded QA prompt from prompts/qa.yaml: {prompt_key}")
            except KeyError as e:
                logger.warning(f"Prompt key '{prompt_key}' not found, using default: {e}")
                self.system_prompt = prompts.get_raw("qa", "qa_system")

        # Create prompt template
        self.prompt_template = ChatPromptTemplate.from_messages([
            ("system", self.system_prompt)
        ])

    def retrieve_context(self, query: str) -> list[Document]:
        """
        Retrieve relevant document chunks for a query.

        Args:
            query: User's question

        Returns:
            List of relevant Document objects

        Raises:
            ValueError: If retriever is not set

        Example:
            >>> docs = qa.retrieve_context("What is machine learning?")
            >>> print(f"Retrieved {len(docs)} chunks")
        """
        if not self.retriever:
            raise ValueError("Retriever not configured")

        logger.info(f"Retrieving context for query: {query[:50]}...")
        docs = self.retriever.invoke(query)
        logger.info(f"Retrieved {len(docs)} relevant chunks")

        return docs

    def format_context(self, documents: list[Document]) -> str:
        """
        Format retrieved documents into a single context string.

        Args:
            documents: List of Document objects

        Returns:
            Concatenated document content

        Example:
            >>> context = qa.format_context(docs)
            >>> print(f"Context length: {len(context)} characters")
        """
        context = "\n\n".join([doc.page_content for doc in documents])
        logger.debug(f"Formatted context: {len(context)} characters")
        return context

    def generate_answer(self, question: str, context: str) -> str:
        """
        Generate answer using LLM (non-streaming).

        Args:
            question: User's question
            context: Retrieved document context

        Returns:
            Generated answer text

        Example:
            >>> answer = qa.generate_answer("What is AI?", context)
            >>> print(answer)
        """
        # Create prompt
        final_prompt = self.prompt_template.invoke({
            "question": question,
            "document": context
        })

        logger.info("Generating answer (non-streaming)...")
        response = self.llm_model.invoke(final_prompt)
        answer = response.content

        logger.info(f"Answer generated: {len(answer)} characters")
        return answer

    def stream_answer(self, question: str, context: str) -> Generator[str, None, None]:
        """
        Stream answer generation token-by-token.

        Args:
            question: User's question
            context: Retrieved document context

        Yields:
            Answer text chunks as they're generated

        Example:
            >>> for chunk in qa.stream_answer("What is AI?", context):
            ...     print(chunk, end="", flush=True)
        """
        # Create prompt
        final_prompt = self.prompt_template.invoke({
            "question": question,
            "document": context
        })

        logger.debug(f"Final prompt generated with {len(context)} characters of context")
        logger.info("Streaming LLM response...")

        # Stream response
        for chunk in self.llm_model.stream(final_prompt):
            yield chunk.content

    def answer_question(
        self,
        question: str,
        stream: bool = True
    ) -> Generator[str, None, None] | str:
        """
        Complete RAG pipeline: retrieve, format, and answer.

        This is the main method that combines retrieval and generation.

        Args:
            question: User's question
            stream: Whether to stream the response

        Returns:
            Generator for streamed response, or string for non-streamed

        Raises:
            ValueError: If no relevant documents found

        Example:
            >>> # Streaming mode
            >>> for chunk in qa.answer_question("What is AI?"):
            ...     print(chunk, end="")
            >>>
            >>> # Non-streaming mode
            >>> answer = qa.answer_question("What is AI?", stream=False)
        """
        # Retrieve context
        docs = self.retrieve_context(question)

        if not docs:
            logger.warning("No relevant documents found")
            raise ValueError("No relevant information found in the document")

        # Format context
        context = self.format_context(docs)

        # Generate answer
        if stream:
            return self.stream_answer(question, context)
        else:
            return self.generate_answer(question, context)

    def update_retriever(self, retriever: VectorStoreRetriever) -> None:
        """
        Update the retriever instance.

        Args:
            retriever: New retriever instance

        Example:
            >>> new_retriever = vector_store.get_retriever(search_k=5)
            >>> qa.update_retriever(new_retriever)
        """
        self.retriever = retriever
        logger.info("Retriever updated")
