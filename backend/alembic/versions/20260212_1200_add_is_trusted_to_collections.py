"""add_is_trusted_to_collections

Revision ID: b1c2d3e4f5a6
Revises: a9c8b7d6e5f4
Create Date: 2026-02-12 12:00:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b1c2d3e4f5a6'
down_revision: Union[str, None] = 'a9c8b7d6e5f4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add is_trusted column to collections table.

    All existing collections default to false (untrusted).
    """
    op.add_column(
        'collections',
        sa.Column(
            'is_trusted',
            sa.Boolean(),
            server_default='false',
            nullable=False
        )
    )


def downgrade() -> None:
    """Remove is_trusted column from collections table."""
    op.drop_column('collections', 'is_trusted')
