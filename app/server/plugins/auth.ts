import { createToolkitAuthPlugin } from "@agent-native/toolkit/app/auth/server";

import { renderTallyfoilAuthPage, renderTallyfoilResetPasswordPage } from "../auth/tallyfoil-auth-page";

export default createToolkitAuthPlugin({
  workspaceAppPublicPaths: ["/"],
  rootAuth: true,
  marketing: false,
  renderSignInPage: renderTallyfoilAuthPage,
  renderResetPasswordPage: renderTallyfoilResetPasswordPage,
});
