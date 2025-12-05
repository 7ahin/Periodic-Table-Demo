declare namespace google.accounts.oauth2 {
  interface TokenResponse { error?: string; error_description?: string; access_token?: string }
  interface TokenClientConfig { client_id: string; scope: string; callback: (resp: TokenResponse) => void }
  interface TokenClientRequestOptions { prompt?: 'none' | 'consent' | 'select_account'; hint?: string; scope?: string }
  interface TokenClient { requestAccessToken: (options?: TokenClientRequestOptions) => void }
  function initTokenClient(config: TokenClientConfig): TokenClient
}

declare global {
  interface Window { google: typeof google; __currentView?: 'table' | 'sphere' | 'helix' | 'grid' }
}
