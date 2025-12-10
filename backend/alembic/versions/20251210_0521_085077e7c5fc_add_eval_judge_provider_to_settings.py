"""add eval_judge_provider to settings

Revision ID: 085077e7c5fc
Revises: 07c37e7c0d1a
Create Date: 2025-12-10 05:21:43.201926+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '085077e7c5fc'
down_revision: Union[str, None] = '07c37e7c0d1a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'settings',
        sa.Column('eval_judge_provider', sa.String(length=20), server_default='openai', nullable=False)
    )


def downgrade() -> None:
    op.drop_column('settings', 'eval_judge_provider')
