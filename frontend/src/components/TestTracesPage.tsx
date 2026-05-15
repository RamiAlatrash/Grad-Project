import { Fragment, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../services/api';
import { TestTrace } from '../../../shared/types';
import {
  Loader2,
  ChevronDown,
  ChevronRight,
  FileText,
  Shield,
  Zap,
  Clock,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/** Human-readable attack label from `attackId` or legacy `testCaseId` (`attackId-iter-N`). */
function parseAttackName(attackKey: string): string {
  const match = attackKey.match(/^(.+?)-iter-\d+$/);
  const attackId = match ? match[1] : attackKey;
  return attackId
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function rowKey(trace: TestTrace, index: number): string {
  if (trace.resultId != null) return `r-${trace.resultId}`;
  return trace.testCaseId ? `${trace.testCaseId}-${index}` : `row-${index}`;
}

export default function TestTracesPage() {
  const [traces, setTraces] = useState<TestTrace[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [loadingDetailId, setLoadingDetailId] = useState<number | null>(null);

  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [successFilter, setSuccessFilter] = useState<'all' | 'true' | 'false'>('all');
  const [providerFilter, setProviderFilter] = useState<string>('');
  const [attackTypeFilter, setAttackTypeFilter] = useState<string>('');
  const requestSeqRef = useRef(0);

  useEffect(() => {
    fetchTraces();
  }, [offset, successFilter, providerFilter, attackTypeFilter]);

  const fetchTraces = async () => {
    const requestId = ++requestSeqRef.current;
    setLoading(true);
    try {
      const filters: {
        limit: number;
        offset: number;
        success?: boolean;
        llmProvider?: string;
        attackType?: string;
      } = { limit, offset };
      if (successFilter !== 'all') filters.success = successFilter === 'true';
      if (providerFilter) filters.llmProvider = providerFilter;
      if (attackTypeFilter) filters.attackType = attackTypeFilter;
      const res = await api.getTestTraces(filters);
      if (requestId === requestSeqRef.current) {
        setTraces(res.data);
        setTotal(res.total);
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (requestId === requestSeqRef.current) {
        setLoading(false);
      }
    }
  };

  const toggleRow = async (trace: TestTrace, index: number) => {
    const id = rowKey(trace, index);
    if (expandedRow === id) {
      setExpandedRow(null);
      return;
    }
    setExpandedRow(id);

    const rid = trace.resultId;
    if (rid == null) return;
    const needsBody = !trace.prompt?.length && !trace.response?.length;
    if (!needsBody) return;

    setLoadingDetailId(rid);
    try {
      const full = await api.getTestTraceByResultId(rid);
      setTraces((prev) =>
        prev.map((t) => (t.resultId === full.resultId ? { ...t, ...full } : t)),
      );
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDetailId((cur) => (cur === rid ? null : cur));
    }
  };

  const pipelineLabel =
    (t: TestTrace) => t.pipelineConfidence ?? t.pipelineConfidencePct;

  return (
    <motion.div
      className="mx-auto max-w-7xl space-y-6 p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Test Traces</h1>
          <p className="mt-2 text-muted-foreground">Deep-dive into individual test run payloads.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          className="rounded-md border border-border bg-card px-3 py-2 text-sm text-card-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          value={successFilter}
          onChange={(e) => {
            setSuccessFilter(e.target.value as 'all' | 'true' | 'false');
            setOffset(0);
          }}
        >
          <option value="all">All Results</option>
          <option value="true">Defended (Success)</option>
          <option value="false">Breached (Failed)</option>
        </select>
        <input
          type="text"
          value={providerFilter}
          onChange={(e) => {
            setProviderFilter(e.target.value);
            setOffset(0);
          }}
          placeholder="Filter by provider..."
          className="w-44 rounded-md border border-border bg-card px-3 py-2 text-sm text-card-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
        />
        <input
          type="text"
          value={attackTypeFilter}
          onChange={(e) => {
            setAttackTypeFilter(e.target.value);
            setOffset(0);
          }}
          placeholder="Filter by attack type..."
          className="w-48 rounded-md border border-border bg-card px-3 py-2 text-sm text-card-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
        />
        <button
          type="button"
          onClick={() => void fetchTraces()}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Refresh
        </button>
        {(providerFilter || attackTypeFilter || successFilter !== 'all') && (
          <button
            type="button"
            onClick={() => {
              setSuccessFilter('all');
              setProviderFilter('');
              setAttackTypeFilter('');
              setOffset(0);
            }}
            className="text-xs text-muted-foreground underline transition-colors hover:text-foreground"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              role="status"
              aria-live="polite"
              className="flex justify-center p-12 pl-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <Loader2 size={32} className="animate-spin text-primary" />
            </motion.div>
          ) : traces.length === 0 ? (
            <motion.div
              key="empty"
              className="p-12 text-center text-muted-foreground"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              No traces found.
            </motion.div>
          ) : (
            <motion.div
              key="table"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
            >
              <table className="w-full table-fixed border-collapse text-left text-sm">
                <colgroup>
                  <col style={{ width: '2.5rem' }} />
                  <col style={{ width: '24%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '26%' }} />
                  <col style={{ width: '24%' }} />
                  <col style={{ width: '5.5rem' }} />
                </colgroup>
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    <th className="cursor-pointer px-2 py-3 pl-4 font-medium" aria-hidden />
                    <th className="px-2 py-3 font-medium">Test Run</th>
                    <th className="px-2 py-3 font-medium">Provider</th>
                    <th className="px-2 py-3 font-medium">Attack Type</th>
                    <th className="px-2 py-3 font-medium">Result</th>
                    <th className="px-4 py-3 pr-4 text-right font-medium">Time (ms)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {traces.map((trace, index) => {
                    const rk = rowKey(trace, index);
                    const isExpanded = expandedRow === rk;
                    const attackName = parseAttackName(trace.attackId || trace.testCaseId);
                    const isLoadingDetail =
                      trace.resultId != null && loadingDetailId === trace.resultId;

                    return (
                      <Fragment key={rk}>
                        <tr
                          className={cn(
                            'cursor-pointer transition-colors hover:bg-muted/50',
                            isExpanded && 'bg-muted/30',
                          )}
                          onClick={() => void toggleRow(trace, index)}
                        >
                          <td className="px-2 py-3 pl-4 text-muted-foreground">
                            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </td>
                          <td className="min-w-0 px-2 py-3 font-medium">
                            <span className="block truncate" title={trace.runName || `Run ${trace.testRunId}`}>
                              {trace.runName || `Run ${trace.testRunId}`}
                            </span>
                          </td>
                          <td className="min-w-0 px-2 py-3 capitalize">
                            <span className="block truncate" title={trace.llmProvider}>
                              {trace.llmProvider}
                            </span>
                          </td>
                          <td className="min-w-0 px-2 py-3">
                            <span className="inline-flex max-w-full items-center gap-1.5 truncate rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400">
                              <Zap size={10} className="flex-shrink-0" />
                              <span className="min-w-0 truncate">{attackName}</span>
                            </span>
                          </td>
                          <td className="min-w-0 px-2 py-3">
                            <span
                              className={cn(
                                'flex min-w-0 items-center gap-1.5 truncate font-medium',
                                trace.success
                                  ? 'text-success'
                                  : 'text-destructive',
                              )}
                              title={
                                trace.success
                                  ? `Defended${pipelineLabel(trace) != null ? ` (${pipelineLabel(trace)}%)` : ''}`
                                  : `Breached${pipelineLabel(trace) != null ? ` (${pipelineLabel(trace)}%)` : ''}`
                              }
                            >
                              {trace.success ? (
                                <span className="h-2 w-2 rounded-full bg-success" />
                              ) : (
                                <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" />
                              )}
                              {trace.success ? 'Defended' : 'Breached'}
                              {pipelineLabel(trace) !== undefined && (
                                <span className="ml-2 text-xs font-normal text-muted-foreground">
                                  ({pipelineLabel(trace)}%)
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="px-4 py-3 pr-4 text-right font-mono text-xs tabular-nums">
                            {trace.executionTimeMs}ms
                          </td>
                        </tr>
                        <AnimatePresence initial={false}>
                          {isExpanded && (
                            <tr className="bg-muted/20">
                              <td colSpan={6} className="p-0">
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                                  style={{ overflow: 'hidden' }}
                                >
                                  <div className="space-y-4 p-5">
                                    <div className="flex flex-wrap items-center gap-3">
                                      <div className="flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs">
                                        <Zap size={12} className="text-amber-400" />
                                        <span className="text-muted-foreground">Attack:</span>
                                        <span className="font-semibold text-foreground">
                                          {attackName}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs">
                                        <span className="text-muted-foreground">Provider:</span>
                                        <span className="font-semibold capitalize text-foreground">
                                          {trace.llmProvider}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs">
                                        {trace.success ? (
                                          <CheckCircle size={12} className="text-green-400" />
                                        ) : (
                                          <XCircle size={12} className="text-destructive" />
                                        )}
                                        <span
                                          className={cn(
                                            'font-semibold',
                                            trace.success ? 'text-green-400' : 'text-destructive',
                                          )}
                                        >
                                          {trace.success ? 'Defended' : 'Breached'}
                                        </span>
                                      </div>
                                      {pipelineLabel(trace) !== undefined && (
                                        <div className="flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs">
                                          <Shield size={12} className="text-primary" />
                                          <span className="text-muted-foreground">Confidence:</span>
                                          <span className="font-semibold text-foreground">
                                            {pipelineLabel(trace)}%
                                          </span>
                                        </div>
                                      )}
                                      <div className="flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs">
                                        <Clock size={12} className="text-muted-foreground" />
                                        <span className="font-semibold text-foreground">
                                          {trace.executionTimeMs}ms
                                        </span>
                                      </div>
                                    </div>

                                    {isLoadingDetail && (
                                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                                        Loading prompt and response…
                                      </div>
                                    )}

                                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                      <div className="overflow-hidden rounded-lg border border-border bg-background">
                                        <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-2.5">
                                          <FileText size={14} className="text-primary" />
                                          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                            Prompt (Excerpt)
                                          </h4>
                                        </div>
                                        <div className="p-4">
                                          <pre className="scrollbar-thin max-h-48 w-full overflow-y-auto break-all font-mono text-[11px] leading-relaxed text-foreground/90 whitespace-pre-wrap">
                                            {isLoadingDetail
                                              ? '…'
                                              : trace.prompt || '(No prompt text)'}
                                          </pre>
                                        </div>
                                      </div>
                                      <div className="overflow-hidden rounded-lg border border-border bg-background">
                                        <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-2.5">
                                          <Shield size={14} className="text-green-400" />
                                          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                            Defense State
                                          </h4>
                                        </div>
                                        <div className="p-4">
                                          <pre className="scrollbar-thin max-h-48 w-full overflow-y-auto break-all font-mono text-[11px] leading-relaxed text-primary whitespace-pre-wrap">
                                            {trace.defenseState
                                              ? JSON.stringify(trace.defenseState, null, 2)
                                              : 'No defense attached'}
                                          </pre>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="overflow-hidden rounded-lg border border-border bg-background">
                                      <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-2.5">
                                        <FileText size={14} className="text-amber-400" />
                                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                          Raw Response
                                        </h4>
                                      </div>
                                      <div className="p-4">
                                        <pre className="scrollbar-thin max-h-64 w-full overflow-y-auto break-all font-mono text-[11px] leading-relaxed text-foreground/90 whitespace-pre-wrap">
                                          {isLoadingDetail
                                            ? '…'
                                            : trace.response || '(No response text)'}
                                        </pre>
                                      </div>
                                    </div>
                                  </div>
                                </motion.div>
                              </td>
                            </tr>
                          )}
                        </AnimatePresence>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div>
          Showing {offset + 1} to {Math.min(offset + limit, total)} of {total} traces
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={offset === 0}
            onClick={() => setOffset((o) => Math.max(0, o - limit))}
            className="rounded border border-border bg-card px-3 py-1 text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            Prev
          </button>
          <button
            type="button"
            disabled={offset + limit >= total}
            onClick={() => setOffset((o) => o + limit)}
            className="rounded border border-border bg-card px-3 py-1 text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </motion.div>
  );
}
