"""add_answer_style_to_settings

Revision ID: a9c8b7d6e5f4
Revises: fa5b076e9557
Create Date: 2025-12-10 22:00:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a9c8b7d6e5f4'
down_revision: Union[str, None] = 'fa5b076e9557'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add answer_style column to settings table."""
    op.add_column(
        'settings',
        sa.Column(
            'answer_style',
            sa.String(length=20),
            server_default='balanced',
            nullable=False
        )
    )


def downgrade() -> None:
    """Remove answer_style column from settings table."""
    op.drop_column('settings', 'answer_style')
