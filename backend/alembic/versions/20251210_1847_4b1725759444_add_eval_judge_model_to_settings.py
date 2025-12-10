"""add_eval_judge_model_to_settings

Revision ID: 4b1725759444
Revises: 1ee42f601d51
Create Date: 2025-12-10 18:47:18.733151+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4b1725759444'
down_revision: Union[str, None] = '1ee42f601d51'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add eval_judge_model column to settings table."""
    op.add_column(
        'settings',
        sa.Column(
            'eval_judge_model',
            sa.String(length=100),
            server_default='gpt-4o-mini',
            nullable=False
        )
    )


def downgrade() -> None:
    """Remove eval_judge_model column from settings table."""
    op.drop_column('settings', 'eval_judge_model')
