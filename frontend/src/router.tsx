import { Navigate, Route, createBrowserRouter, createRoutesFromElements } from "react-router-dom";
import { RequireAuth } from "@/components/require-auth";
import { ComponentsDemo } from "@/dev/components-demo";
import { CampaignAgentsTab } from "@/pages/campaign-agents-tab";
import { CampaignDetail } from "@/pages/campaign-detail";
import { CampaignKnowledgeTab } from "@/pages/campaign-knowledge-tab";
import { CampaignOverviewTab } from "@/pages/campaign-overview-tab";
import { CampaignPromptsTab } from "@/pages/campaign-prompts-tab";
import { CampaignProspectsTab } from "@/pages/campaign-prospects-tab";
import { CampaignSettingsTab } from "@/pages/campaign-settings-tab";
import { CampaignsList } from "@/pages/campaigns-list";
import { Compare } from "@/pages/compare";
import { Inbox } from "@/pages/inbox";
import { Login } from "@/pages/login";
import { NewCampaignWizard } from "@/pages/new-campaign-wizard";
import { Overview } from "@/pages/overview";
import { PromptStudio } from "@/pages/prompt-studio";
import { Prospect360 } from "@/pages/prospect-360";
import { Register } from "@/pages/register";
import { Settings } from "@/pages/settings";

// A data router (rather than plain <BrowserRouter>) so pages can block in-app
// navigation with `useBlocker` (spec: New Campaign Wizard's exit flow) — that hook
// only works with a data router, not the declarative <Routes> render tree alone.
// The route tree itself is unchanged: createRoutesFromElements reads the same JSX.
export const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      <Route path="/dev/components" element={<ComponentsDemo />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route element={<RequireAuth />}>
        <Route index element={<Overview />} />
        <Route path="campaigns" element={<CampaignsList />} />
        <Route path="campaigns/new" element={<NewCampaignWizard />} />
        <Route path="campaigns/:campaignId" element={<CampaignDetail />}>
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<CampaignOverviewTab />} />
          <Route path="prospects" element={<CampaignProspectsTab />} />
          <Route path="agents" element={<CampaignAgentsTab />} />
          <Route path="prompts" element={<CampaignPromptsTab />} />
          <Route path="knowledge" element={<CampaignKnowledgeTab />} />
          <Route path="settings" element={<CampaignSettingsTab />} />
        </Route>
        <Route
          path="campaigns/:campaignId/prospects/:prospectId"
          element={<Prospect360 />}
        />
        <Route path="inbox" element={<Inbox />} />
        <Route path="prompt-studio" element={<PromptStudio />} />
        <Route path="compare" element={<Compare />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </>,
  ),
);
