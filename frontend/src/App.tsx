import { Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AppShell } from "@/components/shell/app-shell";
import { ComponentsDemo } from "@/dev/components-demo";
import { motion } from "@/lib/tokens";
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
import { MissionControl } from "@/pages/mission-control";
import { NewCampaignWizard } from "@/pages/new-campaign-wizard";
import { PromptStudio } from "@/pages/prompt-studio";
import { Prospect360 } from "@/pages/prospect-360";
import { Settings } from "@/pages/settings";

function App() {
  return (
    <>
      <Routes>
        <Route path="/dev/components" element={<ComponentsDemo />} />

        <Route element={<AppShell />}>
          <Route index element={<MissionControl />} />
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
      </Routes>
      <Toaster duration={motion.toastAutoDismissMs} />
    </>
  );
}

export default App;
