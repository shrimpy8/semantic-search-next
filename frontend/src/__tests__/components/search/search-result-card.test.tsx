import { render, screen, fireEvent } from '@testing-library/react';
import { SearchResultCard } from '@/components/search/search-result-card';
import { type SearchResult } from '@/lib/api';

const mockResult: SearchResult = {
  id: '1',
  document_id: 'doc-1',
  document_name: 'test-document.pdf',
  collection_id: 'col-1',
  collection_name: 'Test Collection',
  content: 'This is the content of the search result that matches the query.',
  page: 5,
  section: 'Introduction',
  verified: true,
  scores: {
    semantic_score: 0.92,
    bm25_score: 0.88,
    rerank_score: 0.95,
    final_score: 0.95,
    relevance_percent: 95,
  },
};

describe('SearchResultCard', () => {
  it('renders document name', () => {
    render(<SearchResultCard result={mockResult} rank={1} />);

    expect(screen.getByText('test-document.pdf')).toBeInTheDocument();
  });

  it('displays rank number', () => {
    render(<SearchResultCard result={mockResult} rank={1} />);

    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('shows relevance percentage', () => {
    render(<SearchResultCard result={mockResult} rank={1} />);

    expect(screen.getByText('95%')).toBeInTheDocument();
  });

  it('displays page number', () => {
    render(<SearchResultCard result={mockResult} rank={1} />);

    expect(screen.getByText('Page 5')).toBeInTheDocument();
  });

  it('renders content text', () => {
    render(<SearchResultCard result={mockResult} rank={1} />);

    expect(
      screen.getByText('This is the content of the search result that matches the query.')
    ).toBeInTheDocument();
  });

  it('shows verified badge when result is verified', () => {
    render(<SearchResultCard result={mockResult} rank={1} />);

    expect(screen.getByText('Verified')).toBeInTheDocument();
  });

  it('shows section when available', () => {
    render(<SearchResultCard result={mockResult} rank={1} />);

    expect(screen.getByText('Introduction')).toBeInTheDocument();
  });

  it('shows collection name', () => {
    render(<SearchResultCard result={mockResult} rank={1} />);

    expect(screen.getByText('in Test Collection')).toBeInTheDocument();
  });

  it('displays detailed scores when expanded', () => {
    render(<SearchResultCard result={mockResult} rank={1} />);

    // Click expand button
    const expandButton = screen.getByRole('button', { name: /show more/i });
    fireEvent.click(expandButton);

    // Check score labels are visible
    expect(screen.getByText('Score Breakdown')).toBeInTheDocument();
    expect(screen.getByText('Semantic')).toBeInTheDocument();
    expect(screen.getByText('Keyword')).toBeInTheDocument();
    expect(screen.getByText('Rerank')).toBeInTheDocument();
  });
});
