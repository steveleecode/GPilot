declare namespace chrome {
  namespace runtime {
    interface MessageSender {}

    interface Manifest {
      oauth2?: {
        client_id?: string;
        scopes?: string[];
      };
    }

    const onMessage: {
      addListener(
        callback: (
          message: unknown,
          sender: MessageSender,
          sendResponse: (response: unknown) => void
        ) => boolean | void
      ): void;
    };

    function getManifest(): Manifest;
    function sendMessage<TResponse>(message: unknown): Promise<TResponse>;
  }

  namespace identity {
    interface GetAuthTokenResult {
      token?: string;
      grantedScopes?: string[];
    }

    function getAuthToken(details: {
      interactive: boolean;
      enableGranularPermissions?: boolean;
      scopes?: string[];
    }): Promise<GetAuthTokenResult>;

    function removeCachedAuthToken(details: { token: string }): Promise<void>;
    function clearAllCachedAuthTokens(): Promise<void>;
  }
}
