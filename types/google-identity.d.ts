declare namespace google.accounts.oauth2 {
  interface TokenResponse { error?: string; error_description?: string; access_token?: string }
  interface TokenClientConfig { client_id: string; scope: string; callback: (resp: TokenResponse) => void }
  interface TokenClient { requestAccessToken: () => void }
  function initTokenClient(config: TokenClientConfig): TokenClient
}

declare global {
  interface Window { google: typeof google }
}
