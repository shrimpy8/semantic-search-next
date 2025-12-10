"""Add search config fields to evaluation_results

Revision ID: 07c37e7c0d1a
Revises: a1b2c3d4e5f6
Create Date: 2025-12-10 05:11:33.621494+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '07c37e7c0d1a'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add search configuration columns to evaluation_results table."""
    op.add_column('evaluation_results', sa.Column('search_alpha', sa.Float(), nullable=True))
    op.add_column('evaluation_results', sa.Column('search_preset', sa.String(length=20), nullable=True))
    op.add_column('evaluation_results', sa.Column('search_use_reranker', sa.Boolean(), nullable=True))
    op.add_column('evaluation_results', sa.Column('reranker_provider', sa.String(length=20), nullable=True))
    op.add_column('evaluation_results', sa.Column('chunk_size', sa.Integer(), nullable=True))
    op.add_column('evaluation_results', sa.Column('chunk_overlap', sa.Integer(), nullable=True))


def downgrade() -> None:
    """Remove search configuration columns from evaluation_results table."""
    op.drop_column('evaluation_results', 'chunk_overlap')
    op.drop_column('evaluation_results', 'chunk_size')
    op.drop_column('evaluation_results', 'reranker_provider')
    op.drop_column('evaluation_results', 'search_use_reranker')
    op.drop_column('evaluation_results', 'search_preset')
    op.drop_column('evaluation_results', 'search_alpha')
