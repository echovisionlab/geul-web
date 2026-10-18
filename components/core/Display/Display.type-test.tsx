import { Table, ScrollArea } from './Display';
import { Pagination } from './Pagination';

<Table.ScrollContainer minWidth={640} role="region" aria-label="Submissions" tabIndex={0}>
  <Table />
</Table.ScrollContainer>;
<ScrollArea role="region" aria-label="Results" tabIndex={0} />;
// @ts-expect-error Accessible native semantics do not reopen presentation props.
<Table.ScrollContainer role="region" style={{ background: 'red' }} />;
// @ts-expect-error Variable spreads must retain the closed presentation boundary.
<Table.ScrollContainer {...{ className: 'foreign' }} />;
// @ts-expect-error Framework styles remain private implementation details.
<Table.ScrollContainer styles={{ root: {} }} />;

<Table rowDividers="between" />;
// @ts-expect-error Divider composition is a finite Core contract.
<Table rowDividers="custom" />;
// @ts-expect-error Variable spreads cannot provide arbitrary divider styling.
<Table {...{ rowDividers: 'arbitrary' }} />;

const pageLabels = { previousPage: 'Previous', nextPage: 'Next', page: (page: number) => `Page ${page}` };
<Pagination value={1} total={3} onChange={() => undefined} labels={pageLabels} />;
<Pagination
  value={1}
  total={3}
  getHref={(page) => `?page=${page}`}
  scroll
  prefetch={false}
  onNavigate={(event) => event.preventDefault()}
  labels={{ ...pageLabels, firstPage: 'First', lastPage: 'Last' }}
/>;
// @ts-expect-error A pager owns its page either through state or through URLs, never both.
<Pagination value={1} total={3} onChange={() => undefined} getHref={(page) => `?page=${page}`} labels={pageLabels} />;
// @ts-expect-error Navigation options belong to link mode only.
<Pagination value={1} total={3} onChange={() => undefined} scroll={false} labels={pageLabels} />;
// @ts-expect-error Navigation interception belongs to link mode only.
<Pagination value={1} total={3} onChange={() => undefined} onNavigate={() => undefined} labels={pageLabels} />;
// @ts-expect-error One page-change channel is required.
<Pagination value={1} total={3} labels={pageLabels} />;
// @ts-expect-error Page hrefs are strings, not arbitrary values.
<Pagination value={1} total={3} getHref={(page) => page} labels={pageLabels} />;
// @ts-expect-error Pagination items do not reopen presentation props.
<Pagination value={1} total={3} getHref={(page) => `?page=${page}`} className="pager" labels={pageLabels} />;
