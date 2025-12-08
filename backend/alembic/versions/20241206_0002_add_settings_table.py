"""Add settings table

Revision ID: 0002
Revises: 0001
Create Date: 2024-12-06

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create settings table
    op.create_table(
        "settings",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "key",
            sa.String(50),
            nullable=False,
            server_default="'global'",
        ),
        # Search defaults
        sa.Column(
            "default_alpha",
            sa.Float(),
            nullable=False,
            server_default="0.5",
        ),
        sa.Column(
            "default_use_reranker",
            sa.Boolean(),
            nullable=False,
            server_default="true",
        ),
        sa.Column(
            "default_preset",
            sa.String(20),
            nullable=False,
            server_default="'balanced'",
        ),
        sa.Column(
            "default_top_k",
            sa.Integer(),
            nullable=False,
            server_default="5",
        ),
        # Admin/Advanced settings
        sa.Column(
            "embedding_model",
            sa.String(100),
            nullable=False,
            server_default="'text-embedding-3-large'",
        ),
        sa.Column(
            "chunk_size",
            sa.Integer(),
            nullable=False,
            server_default="1000",
        ),
        sa.Column(
            "chunk_overlap",
            sa.Integer(),
            nullable=False,
            server_default="200",
        ),
        sa.Column(
            "reranker_provider",
            sa.String(20),
            nullable=False,
            server_default="'auto'",
        ),
        # Display settings
        sa.Column(
            "show_scores",
            sa.Boolean(),
            nullable=False,
            server_default="true",
        ),
        sa.Column(
            "results_per_page",
            sa.Integer(),
            nullable=False,
            server_default="10",
        ),
        # Timestamps
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("key"),
    )

    # Insert default global settings row
    op.execute(
        """
        INSERT INTO settings (id, key)
        VALUES (gen_random_uuid(), 'global')
        """
    )


def downgrade() -> None:
    op.drop_table("settings")
