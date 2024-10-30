export class InvalidUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidUrlError';
  }
}

export class DPopProofError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DPopProofError';
  }
}

export class JWKSGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JWKSGenerationError';
  }
}

export class OAuthClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OAuthClientError';
  }
}

export class OAuthAuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OAuthAuthorizationError';
  }
}

export class OAuthServerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OAuthServerError';
  }
} 

export class OAuthTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OAuthTokenError';
  }
}


export class OAuthTokenRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OAuthTokenRequestError';
  }
}

export class RateLimitExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitExceededError';
  }
}