import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CollectionCard } from '@/components/collections/collection-card';
import { type Collection } from '@/lib/api';

const mockCollection: Collection = {
  id: '1',
  name: 'Test Collection',
  description: 'A test collection description',
  is_trusted: false,
  document_count: 5,
  chunk_count: 100,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-02T00:00:00Z',
};

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe('CollectionCard', () => {
  it('renders collection name and description', () => {
    renderWithProviders(<CollectionCard collection={mockCollection} />);

    expect(screen.getByText('Test Collection')).toBeInTheDocument();
    expect(screen.getByText('A test collection description')).toBeInTheDocument();
  });

  it('displays document count', () => {
    renderWithProviders(<CollectionCard collection={mockCollection} />);

    expect(screen.getByText('5 documents')).toBeInTheDocument();
  });

  it('shows "No description" when description is empty', () => {
    const collectionWithoutDesc = { ...mockCollection, description: undefined };
    renderWithProviders(<CollectionCard collection={collectionWithoutDesc} />);

    expect(screen.getByText('No description')).toBeInTheDocument();
  });

  it('has a link to collection detail page', () => {
    renderWithProviders(<CollectionCard collection={mockCollection} />);

    const link = screen.getByRole('link', { name: 'Test Collection' });
    expect(link).toHaveAttribute('href', '/collections/1');
  });

  it('opens dropdown menu on button click', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CollectionCard collection={mockCollection} />);

    const menuButton = screen.getByRole('button', { name: 'Open menu' });
    await user.click(menuButton);

    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('shows trusted badge when collection is trusted', () => {
    const trustedCollection = { ...mockCollection, is_trusted: true };
    renderWithProviders(<CollectionCard collection={trustedCollection} />);

    expect(screen.getByText('Trusted')).toBeInTheDocument();
  });

  it('does not show trusted badge when collection is not trusted', () => {
    const untrustedCollection = { ...mockCollection, is_trusted: false };
    renderWithProviders(<CollectionCard collection={untrustedCollection} />);

    expect(screen.queryByText('Trusted')).not.toBeInTheDocument();
  });
});
