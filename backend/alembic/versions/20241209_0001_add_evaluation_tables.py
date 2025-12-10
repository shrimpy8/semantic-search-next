"""Add evaluation tables for LLM-based search quality assessment.

Creates tables for:
- ground_truths: Expected answers for evaluation comparison
- evaluation_results: Individual evaluation scores
- evaluation_runs: Batch evaluation job tracking (Phase 2)

Also extends search_queries with columns for storing evaluation data.

Revision ID: a1b2c3d4e5f6
Revises: d1f4fac42d78
Create Date: 2024-12-09
"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "d1f4fac42d78"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ==========================================================================
    # 1. Ground Truths Table - Expected answers for evaluation
    # ==========================================================================
    op.create_table(
        "ground_truths",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "collection_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("collections.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("query", sa.Text(), nullable=False),
        sa.Column("expected_answer", sa.Text(), nullable=False),
        sa.Column("expected_sources", postgresql.JSONB(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
    )
    # Composite index for query lookup within collection
    op.create_index(
        "idx_ground_truths_collection_query",
        "ground_truths",
        ["collection_id", "query"],
    )

    # ==========================================================================
    # 2. Evaluation Runs Table - Batch job tracking (Phase 2)
    # ==========================================================================
    op.create_table(
        "evaluation_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("judge_provider", sa.String(20), nullable=False),
        sa.Column("judge_model", sa.String(100), nullable=False),
        sa.Column(
            "collection_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("collections.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("total_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("completed_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("failed_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
    )
    op.create_index("idx_evaluation_runs_status", "evaluation_runs", ["status"])
    op.create_index("idx_evaluation_runs_created_at", "evaluation_runs", ["created_at"])

    # ==========================================================================
    # 3. Evaluation Results Table - Individual evaluation scores
    # ==========================================================================
    op.create_table(
        "evaluation_results",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        # Foreign keys
        sa.Column(
            "search_query_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("search_queries.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column(
            "ground_truth_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("ground_truths.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column(
            "evaluation_run_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("evaluation_runs.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        # Input data (stored for reproducibility)
        sa.Column("query", sa.Text(), nullable=False),
        sa.Column("generated_answer", sa.Text(), nullable=True),
        sa.Column("expected_answer", sa.Text(), nullable=True),
        sa.Column("retrieved_chunks", postgresql.JSONB(), nullable=True),
        # Judge info
        sa.Column("judge_provider", sa.String(20), nullable=False),
        sa.Column("judge_model", sa.String(100), nullable=False),
        # Retrieval Metrics (0.0-1.0)
        sa.Column("context_relevance", sa.Float(), nullable=True),
        sa.Column("context_precision", sa.Float(), nullable=True),
        sa.Column("context_coverage", sa.Float(), nullable=True),
        # Answer Metrics (0.0-1.0)
        sa.Column("faithfulness", sa.Float(), nullable=True),
        sa.Column("answer_relevance", sa.Float(), nullable=True),
        sa.Column("completeness", sa.Float(), nullable=True),
        # Ground Truth Comparison (0.0-1.0)
        sa.Column("ground_truth_similarity", sa.Float(), nullable=True),
        # Aggregate scores
        sa.Column("retrieval_score", sa.Float(), nullable=True),
        sa.Column("answer_score", sa.Float(), nullable=True),
        sa.Column("overall_score", sa.Float(), nullable=True),
        # Raw LLM output for debugging
        sa.Column("raw_eval_response", postgresql.JSONB(), nullable=True),
        # Metadata
        sa.Column("eval_latency_ms", sa.Integer(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "idx_evaluation_results_created_at", "evaluation_results", ["created_at"]
    )
    op.create_index(
        "idx_evaluation_results_overall_score", "evaluation_results", ["overall_score"]
    )

    # ==========================================================================
    # 4. Extend search_queries with columns for evaluation data
    # ==========================================================================
    op.add_column(
        "search_queries",
        sa.Column("retrieved_chunks", postgresql.JSONB(), nullable=True),
    )
    op.add_column(
        "search_queries",
        sa.Column("generated_answer", sa.Text(), nullable=True),
    )
    op.add_column(
        "search_queries",
        sa.Column("answer_sources", postgresql.JSONB(), nullable=True),
    )


def downgrade() -> None:
    # Remove columns from search_queries
    op.drop_column("search_queries", "answer_sources")
    op.drop_column("search_queries", "generated_answer")
    op.drop_column("search_queries", "retrieved_chunks")

    # Drop tables in reverse order (respect foreign key constraints)
    op.drop_index("idx_evaluation_results_overall_score", table_name="evaluation_results")
    op.drop_index("idx_evaluation_results_created_at", table_name="evaluation_results")
    op.drop_table("evaluation_results")

    op.drop_index("idx_evaluation_runs_created_at", table_name="evaluation_runs")
    op.drop_index("idx_evaluation_runs_status", table_name="evaluation_runs")
    op.drop_table("evaluation_runs")

    op.drop_index("idx_ground_truths_collection_query", table_name="ground_truths")
    op.drop_table("ground_truths")
