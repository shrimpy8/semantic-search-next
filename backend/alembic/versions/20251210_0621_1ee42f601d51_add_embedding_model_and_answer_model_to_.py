"""add embedding_model and answer_model to evaluation_results

Revision ID: 1ee42f601d51
Revises: 085077e7c5fc
Create Date: 2025-12-10 06:21:33.335744+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1ee42f601d51'
down_revision: Union[str, None] = '085077e7c5fc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('evaluation_results', sa.Column('embedding_model', sa.String(length=100), nullable=True))
    op.add_column('evaluation_results', sa.Column('answer_model', sa.String(length=100), nullable=True))


def downgrade() -> None:
    op.drop_column('evaluation_results', 'answer_model')
    op.drop_column('evaluation_results', 'embedding_model')
