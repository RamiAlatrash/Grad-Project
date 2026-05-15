import React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  MessageSquare, FileText, BarChart3, SplitSquareHorizontal,
  Shield, Bug, FlaskConical, ClipboardList, Users,
  Lightbulb, Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface HelpStep {
  label: string;
  detail: string;
}

interface PageHelp {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  steps: HelpStep[];
  tip?: string;
}

const PAGE_HELP: Record<string, PageHelp> = {
  chat: {
    icon: <MessageSquare className="h-5 w-5" />,
    title: 'Using the Chat',
    subtitle: 'Ask questions and get AI-powered answers grounded in your documents.',
    steps: [
      {
        label: 'Type your question',
        detail: 'Click the message box at the bottom of the screen and type any question you want answered.',
      },
      {
        label: 'Send your message',
        detail: 'Press Enter or click the Send button. The AI will respond using any documents you have attached.',
      },
      {
        label: 'Attach documents for context',
        detail: 'Click the paperclip icon in the message bar to attach documents from your library. The AI will ground its answers in those files.',
      },
      {
        label: 'Start a new conversation',
        detail: 'Click "New Chat" at the top of the sidebar to begin a fresh session. Previous sessions remain in your chat history for 24 hours.',
      },
      {
        label: 'Switch between sessions',
        detail: 'Click any past session in the sidebar to resume it. Each session keeps its own message history and attached documents.',
      },
    ],
    tip: 'For best results, attach a relevant document before asking detailed questions about its content.',
  },

  documents: {
    icon: <FileText className="h-5 w-5" />,
    title: 'Managing Documents',
    subtitle: 'Upload files to build a knowledge base the AI can reference during chat.',
    steps: [
      {
        label: 'Upload a document',
        detail: 'Click the "Upload Document" button and select a file from your computer (PDF, TXT, or DOCX are supported).',
      },
      {
        label: 'Wait for processing',
        detail: 'The system indexes your document automatically. Once the status shows as ready, it can be used in chat.',
      },
      {
        label: 'Attach a document to chat',
        detail: 'Use the toggle next to a document to attach it to your active chat session. Attached documents provide the AI with additional context.',
      },
      {
        label: 'Delete documents you no longer need',
        detail: 'Click the trash icon on any document card to permanently remove it. This also detaches it from any active sessions.',
      },
      {
        label: 'Refresh the list',
        detail: 'If you uploaded a file from another session or device, click the Refresh button to sync the latest document list.',
      },
    ],
    tip: 'Keep documents focused and concise. Uploaded .txt files are always treated as untrusted; use InfoBank clean fixtures when you need a known-safe baseline for the Comparison Simulator.',
  },

  analytics: {
    icon: <BarChart3 className="h-5 w-5" />,
    title: 'Analytics Dashboard',
    subtitle: 'Monitor system-wide security metrics and track how defenses perform under attack.',
    steps: [
      {
        label: 'Read the KPI cards',
        detail: 'The top row of cards shows aggregated totals: total tests run, attacks blocked, bypass rate, and average defense latency.',
      },
      {
        label: 'Interpret the charts',
        detail: 'Charts below the KPIs break down results over time and by attack category. Hover over any data point for exact figures.',
      },
      {
        label: 'Identify weak spots',
        detail: 'Look for attack categories with a high bypass rate — those are the areas where defenses need improvement.',
      },
      {
        label: 'Track trends over time',
        detail: 'The time-series chart shows whether your defense configuration is improving or degrading as you make changes.',
      },
    ],
    tip: 'Run a fresh Stress Test after enabling or disabling defenses to see updated analytics.',
  },

  simulator: {
    icon: <SplitSquareHorizontal className="h-5 w-5" />,
    title: 'Comparison Simulator',
    subtitle: 'Run an attack against two defense configurations side-by-side to compare outcomes.',
    steps: [
      {
        label: 'Choose an attack',
        detail: 'Select an attack type from the left panel. This is the prompt injection that will be sent to the system.',
      },
      {
        label: 'Configure both sides',
        detail: 'Each column represents a different defense configuration. Enable or disable defenses independently for each side.',
      },
      {
        label: 'Select a test document',
        detail: 'Optionally attach a document so the AI has context. This makes the comparison more realistic.',
      },
      {
        label: 'Run the simulation',
        detail: 'Click "Run" to send the attack through both configurations simultaneously. Results appear in each column.',
      },
      {
        label: 'Compare the outputs',
        detail: 'Read both responses to see how the defense configuration affected the AI\'s behavior. Look for blocked injections vs. successful ones.',
      },
    ],
    tip: 'The clean column only includes InfoBank clean fixtures and other trusted-context docs. Poisoned InfoBank loads and user-uploaded .txt files are excluded from the baseline. Try the same attack with all defenses off on one side to show the contrast.',
  },

  defenses: {
    icon: <Shield className="h-5 w-5" />,
    title: 'Defense Configuration',
    subtitle: 'Enable and disable defense layers that protect the AI from prompt injection attacks.',
    steps: [
      {
        label: 'Browse available defenses',
        detail: 'Each card represents a defense mechanism. Read the description to understand what type of attack it targets.',
      },
      {
        label: 'Toggle a defense on or off',
        detail: 'Click the toggle switch on any defense card to enable or disable it. Active defenses run on every incoming query.',
      },
      {
        label: 'Check the active count',
        detail: 'The badge on the "Defenses" nav item shows how many defenses are currently enabled at a glance.',
      },
      {
        label: 'Read the detail view',
        detail: 'Click a defense card to expand its detail view, which explains the detection mechanism and known limitations.',
      },
      {
        label: 'Test your configuration',
        detail: 'After adjusting defenses, run a Stress Test or use the Simulator to validate how the new setup performs.',
      },
    ],
    tip: 'Enabling all defenses increases latency. For a presentation, start with a balanced set and demonstrate the impact of adding more.',
  },

  attacks: {
    icon: <Bug className="h-5 w-5" />,
    title: 'Attack Library',
    subtitle: 'Browse built-in prompt injection attacks or create custom ones for testing.',
    steps: [
      {
        label: 'Browse built-in attacks',
        detail: 'The library contains pre-built attacks organized by category and severity tier. Click any attack to see its injection text and description.',
      },
      {
        label: 'Understand the tiers',
        detail: 'Tier 1 attacks are basic; Tier 3 are advanced. Higher-tier attacks are more likely to bypass standard defenses.',
      },
      {
        label: 'Create a custom attack',
        detail: 'Click "Create Attack" and fill in the name, category, tier, and the actual injection text. Custom attacks can be used in the Simulator and Stress Test.',
      },
      {
        label: 'Use an attack in testing',
        detail: 'Navigate to the Simulator or Stress Test and select your attack from the dropdown. Built-in attacks are always available.',
      },
      {
        label: 'Delete custom attacks',
        detail: 'Custom attacks have a delete option. Built-in attacks are read-only and cannot be removed.',
      },
    ],
    tip: 'Use the category filter to focus on a specific attack class (e.g. "Jailbreak" or "Data Exfiltration") when preparing a demonstration.',
  },

  testing: {
    icon: <FlaskConical className="h-5 w-5" />,
    title: 'Stress Test',
    subtitle: 'Run a bulk batch of attacks against the current defense configuration and measure outcomes.',
    steps: [
      {
        label: 'Select a document set',
        detail: 'Choose one or more documents to include as context. This makes the test more realistic by providing the AI with actual content to protect.',
      },
      {
        label: 'Choose attacks to include',
        detail: 'Select individual attacks or pick an entire category. More attacks mean a longer but more comprehensive test.',
      },
      {
        label: 'Set the run count',
        detail: 'Each attack can be run multiple times to reduce variance. A count of 3–5 gives reliable averages without excessive time.',
      },
      {
        label: 'Launch the test',
        detail: 'Click "Start Test". Progress is shown in real time. Do not navigate away — the job runs on the backend but results stream here.',
      },
      {
        label: 'Review results when complete',
        detail: 'When the test finishes, a summary card appears showing blocked vs. bypassed counts. Full traces are stored under Test Traces.',
      },
    ],
    tip: 'Run the test twice — once with all defenses off and once with your best configuration — to produce a compelling before/after comparison for a presentation.',
  },

  'test-traces': {
    icon: <ClipboardList className="h-5 w-5" />,
    title: 'Test Traces',
    subtitle: 'Review the full conversation logs from every completed stress test run.',
    steps: [
      {
        label: 'Find a test run',
        detail: 'Traces are listed in reverse chronological order. Each row shows the date, attack used, defense state, and outcome.',
      },
      {
        label: 'Open a trace',
        detail: 'Click any row to expand the full conversation: the injected prompt, the AI response, and which defenses fired.',
      },
      {
        label: 'Filter by outcome',
        detail: 'Use the filter bar to show only "Blocked", "Bypassed", or "Error" results to quickly find failures.',
      },
      {
        label: 'Filter by attack category',
        detail: 'Narrow the list to a specific attack type to understand which category poses the most risk.',
      },
      {
        label: 'Export trace data',
        detail: 'Use the export option (if available) to download traces as JSON for offline analysis or inclusion in a report.',
      },
    ],
    tip: 'Focus on "Bypassed" traces during a presentation — they illustrate why defenses are necessary and what happens without them.',
  },

  users: {
    icon: <Users className="h-5 w-5" />,
    title: 'User Management',
    subtitle: 'Create, view, and manage user accounts and roles for the THRAX platform.',
    steps: [
      {
        label: 'View the user list',
        detail: 'The table shows all registered users with their email, role, and account creation date.',
      },
      {
        label: 'Create a new user',
        detail: 'Click "Create User" and fill in the email, password, and role. Regular users only see Chat and Documents; admins have full access.',
      },
      {
        label: 'Understand user roles',
        detail: '"User" role: Chat and Documents only. "Admin" role: full platform including Lab, Stress Test, and User Management. "Super Admin": same as Admin with elevated permissions.',
      },
      {
        label: 'Edit or deactivate an account',
        detail: 'Click the action menu (three dots) on any user row to edit their role or deactivate their account.',
      },
      {
        label: 'Search and filter',
        detail: 'Use the search bar above the table to find users by email. Use the role filter to list only admins or only regular users.',
      },
    ],
    tip: 'For a demo, create a plain "user" account and log in as them to show what the restricted interface looks like.',
  },
};

interface HelpPanelProps {
  isOpen: boolean;
  onClose: () => void;
  activePage: string;
}

const HelpPanel: React.FC<HelpPanelProps> = ({ isOpen, onClose, activePage }) => {
  const help = PAGE_HELP[activePage] ?? PAGE_HELP['chat'];

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent
        side="right"
        className="w-[420px] sm:max-w-[420px] flex flex-col gap-0 p-0 overflow-hidden"
      >
        {/* Header */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3 mb-1">
            <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary/10 text-primary shrink-0">
              {help.icon}
            </div>
            <SheetTitle className="text-base font-semibold">{help.title}</SheetTitle>
          </div>
          <SheetDescription className="text-sm text-muted-foreground leading-relaxed pl-11">
            {help.subtitle}
          </SheetDescription>
        </SheetHeader>

        {/* Steps */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-1">
          <p className="text-[11px] font-semibold tracking-widest uppercase text-muted-foreground mb-4">
            Step by Step
          </p>

          <ol className="space-y-0">
            {help.steps.map((step, index) => (
              <li key={index} className="flex gap-4">
                {/* Step number + connector line */}
                <div className="flex flex-col items-center shrink-0">
                  <div
                    className={cn(
                      'flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0 mt-0.5',
                      'bg-primary/10 text-primary border border-primary/20',
                    )}
                  >
                    {index + 1}
                  </div>
                  {index < help.steps.length - 1 && (
                    <div className="w-px flex-1 bg-border mt-1 mb-1 min-h-[16px]" />
                  )}
                </div>

                {/* Content */}
                <div className={cn('pb-5', index === help.steps.length - 1 && 'pb-1')}>
                  <p className="text-sm font-medium text-foreground leading-snug">{step.label}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed mt-0.5">{step.detail}</p>
                </div>
              </li>
            ))}
          </ol>

          {/* Tip box */}
          {help.tip && (
            <div className="mt-5 rounded-lg border border-border bg-muted/40 px-4 py-3">
              <div className="flex items-start gap-2.5">
                <Lightbulb className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-primary mb-1">
                    Pro Tip
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{help.tip}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-border px-6 py-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 shrink-0" />
            <span>
              This guide updates automatically when you navigate to a different page.
            </span>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default HelpPanel;
