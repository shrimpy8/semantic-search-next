"""add_answer_provider_model_to_settings

Revision ID: fa5b076e9557
Revises: 4b1725759444
Create Date: 2025-12-10 18:52:07.017827+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fa5b076e9557'
down_revision: Union[str, None] = '4b1725759444'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add answer_provider and answer_model columns to settings table."""
    op.add_column(
        'settings',
        sa.Column(
            'answer_provider',
            sa.String(length=20),
            server_default='openai',
            nullable=False
        )
    )
    op.add_column(
        'settings',
        sa.Column(
            'answer_model',
            sa.String(length=100),
            server_default='gpt-4o-mini',
            nullable=False
        )
    )


def downgrade() -> None:
    """Remove answer_provider and answer_model columns from settings table."""
    op.drop_column('settings', 'answer_model')
    op.drop_column('settings', 'answer_provider')
