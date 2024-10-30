# Bluesky OAuth Client

**Status:** Work in Progress

A robust and reusable npm package for integrating Bluesky's OAuth 2.0 authentication into your Node.js applications. This package manages the complete OAuth flow, including Proof Key for Code Exchange (PKCE), Demonstrating Proof of Possession (DPoP), and secure handling of user data.

## Table of Contents

- [Bluesky OAuth Client](#bluesky-oauth-client)
  - [Table of Contents](#table-of-contents)
  - [Features](#features)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Setup](#setup)
    - [1. Generate JSON Web Key Set (JWKS)](#1-generate-json-web-key-set-jwks)
    - [2. Generate Client Metadata](#2-generate-client-metadata)
    - [3. Host Client Metadata and JWKS](#3-host-client-metadata-and-jwks)
  - [Usage](#usage)
    - [1. Initialize the OAuth Client](#1-initialize-the-oauth-client)
    - [2. Start the OAuth Flow](#2-start-the-oauth-flow)
    - [3. Handle the OAuth Callback](#3-handle-the-oauth-callback)
    - [4. Make Authenticated Requests](#4-make-authenticated-requests)
  - [API Reference](#api-reference)
    - [BlueskyOAuthClient Class](#blueskyoauthclient-class)
      - [Constructor](#constructor)
      - [Parameters](#parameters)
    - [Methods](#methods)
      - [`getAuthorizationUrl()`](#getauthorizationurl)
      - [`handleCallback(code: string, codeVerifier: string)`](#handlecallbackcode-string-codeverifier-string)
      - [`makeAuthenticatedRequest(method: string, url: string, accessToken: string, data?: any)`](#makeauthenticatedrequestmethod-string-url-string-accesstoken-string-data-any)
    - [Helper Functions](#helper-functions)
      - [`generateJWKS()`](#generatejwks)
      - [`generateClientMetadata(options: ClientMetadataOptions)`](#generateclientmetadataoptions-clientmetadataoptions)
    - [Security Considerations](#security-considerations)
  - [Contributing](#contributing)
  - [License](#license)

## Features

- **PKCE Support:** Enhances security during the authorization code exchange.
- **DPoP Proofs:** Binds tokens to specific client devices.
- **Secure URL Validation:** Protects against SSRF and DoS attacks.
- **Helper Functions:** Simplifies the generation of JWKS and client metadata.
- **Modular Design:** Easily integrate and extend functionalities as needed.

## Prerequisites

- **Node.js:** Version 14 or later.
- **npm:** Required for installing the package and its dependencies.

## Installation

Install the `bluesky-oauth-client` package via npm:

```bash
npm install bluesky-oauth-client
```

## Setup

To effectively use the `bluesky-oauth-client`, follow these setup steps:

### 1. Generate JSON Web Key Set (JWKS)

Bluesky's OAuth requires a set of public keys (JWKS) for verifying tokens. Use the provided helper function to generate your JWKS.

```typescript
// generateJWKS.ts
import { generateJWKS } from 'bluesky-oauth-client';
import fs from 'fs';

async function setupJWKS() {
  const { jwks, privateKey } = await generateJWKS();

  // Save JWKS to a file or database
  fs.writeFileSync('jwks.json', JSON.stringify(jwks, null, 2));

  // Securely store `privateKey` for signing DPoP proofs
  // Do NOT expose this publicly or commit it to version control
  fs.writeFileSync('privateKey.json', JSON.stringify(privateKey, null, 2));
}

setupJWKS().catch((error) => {
  console.error('Error generating JWKS:', error);
});
```

Run the script:

```bash
ts-node generateJWKS.ts
```

**Outputs:**

- **jwks.json:** Your public JWKS, which will be hosted publicly.
- **privateKey.json:** Your private key, used for signing DPoP proofs (keep this secure).

### 2. Generate Client Metadata

Use the helper function to create your `client-metadata.json`, which contains essential OAuth client information.

```typescript
// generateClientMetadata.ts
import { generateClientMetadata } from 'bluesky-oauth-client';
import fs from 'fs';

const clientMetadata = generateClientMetadata({
  clientName: "Your App Name",
  redirectUris: ["https://yourapp.com/oauth/callback"],
  scopes: ["openid", "profile"],
  jwksUri: "https://yourapp.com/oauth/jwks.json", // URL where `jwks.json` is hosted
});

// Save the client metadata to a file
fs.writeFileSync('client-metadata.json', JSON.stringify(clientMetadata, null, 2));
```

Run the script:

```bash
ts-node generateClientMetadata.ts
```

**Output:**

- **client-metadata.json:** Contains your OAuth client's public metadata.

### 3. Host Client Metadata and JWKS

Both **client-metadata.json** and **jwks.json** need to be accessible via HTTPS URLs.

**Host `jwks.json`:**

Upload `jwks.json` to a secure and publicly accessible URL, such as:

```
https://yourapp.com/oauth/jwks.json
```

**Host `client-metadata.json`:**

Upload `client-metadata.json` to the URL specified in its `client_id` field, for example:

```
https://yourapp.com/oauth/client-metadata.json
```

Ensure that the `jwks_uri` in `client-metadata.json` correctly points to your hosted `jwks.json`.

## Usage

Follow these steps to integrate Bluesky OAuth into your application using the `bluesky-oauth-client` package.

### 1. Initialize the OAuth Client

First, initialize the `BlueskyOAuthClient` with the necessary configurations.

```typescript
// initializeOAuthClient.ts
import { BlueskyOAuthClient } from 'bluesky-oauth-client';
import fs from 'fs';

// Load your private and public keys
const jwkPrivate = JSON.parse(fs.readFileSync('path/to/privateKey.json', 'utf-8'));
const jwkPublic = JSON.parse(fs.readFileSync('path/to/jwks.json', 'utf-8')).keys[0];

const oauthClient = new BlueskyOAuthClient({
  clientId: 'https://yourapp.com/oauth/client-metadata.json',
  redirectUri: 'https://yourapp.com/oauth/callback',
  scopes: ['openid', 'profile'], // Optional: defaults to ['openid', 'profile']
  jwkPrivate,
  jwkPublic,
});
```

### 2. Start the OAuth Flow

Generate the authorization URL and initiate the OAuth process.

```typescript
// startOAuthFlow.ts
import { BlueskyOAuthClient } from 'bluesky-oauth-client';

async function startOAuth(oauthClient: BlueskyOAuthClient) {
  const { url, codeVerifier } = await oauthClient.getAuthorizationUrl();

  console.log('Visit this URL to authorize:', url);
  // Redirect the user to `url` or present it to them to visit

  // Store `codeVerifier` securely (e.g., in user session)
  // This is required to exchange the authorization code later
}

startOAuth(oauthClient).catch((error) => {
  console.error('Error starting OAuth flow:', error);
});
```

### 3. Handle the OAuth Callback

After the user authorizes your application, Bluesky will redirect them to your specified `redirectUri` with an authorization code. Exchange this code for access tokens.

```typescript
// handleOAuthCallback.ts
import { BlueskyOAuthClient } from 'bluesky-oauth-client';

async function handleCallback(oauthClient: BlueskyOAuthClient, code: string, codeVerifier: string) {
  try {
    const tokens = await oauthClient.handleCallback(code, codeVerifier);
    console.log('Access Token:', tokens.access_token);
    // Optionally store tokens securely for future authenticated requests
  } catch (error) {
    console.error('Error handling OAuth callback:', error);
  }
}

// Example usage:
// Assume `code` is obtained from query parameters and `codeVerifier` from session
handleCallback(oauthClient, 'authorization_code_from_callback', 'stored_code_verifier').catch((error) => {
  console.error('Error:', error);
});
```

### 4. Make Authenticated Requests

Use the obtained access token to make authenticated requests to protected resources.

```typescript
// makeAuthenticatedRequest.ts
import { BlueskyOAuthClient } from 'bluesky-oauth-client';

async function fetchProtectedResource(oauthClient: BlueskyOAuthClient, accessToken: string) {
  const resourceUrl = 'https://bsky.social/api/some-protected-resource';

  try {
    const responseData = await oauthClient.makeAuthenticatedRequest(
      'GET',
      resourceUrl,
      accessToken
    );

    console.log('Protected Resource Data:', responseData);
  } catch (error) {
    console.error('Error fetching protected resource:', error);
  }
}

// Example usage:
// Assume `accessToken` is obtained from previous steps
fetchProtectedResource(oauthClient, 'your_access_token').catch((error) => {
  console.error('Error:', error);
});
```

## API Reference

### BlueskyOAuthClient Class

#### Constructor

```typescript
new BlueskyOAuthClient(options: OAuthClientOptions)
```

#### Parameters

- **options**: An object containing configuration options.
  - `clientId` (string, required): URL to your `client-metadata.json` (e.g., `https://yourapp.com/oauth/client-metadata.json`).
  - `redirectUri` (string, required): Your OAuth callback URL (e.g., `https://yourapp.com/oauth/callback`).
  - `scopes` (string[], optional): Array of OAuth scopes. Defaults to `['openid', 'profile']`.
  - `jwkPrivate` (object, required): Your private JSON Web Key for signing DPoP proofs.
  - `jwkPublic` (object, required): Your public JSON Web Key from your JWKS.

### Methods

#### `getAuthorizationUrl()`

Initiates the OAuth flow by generating the authorization URL and a code verifier.

```typescript
async getAuthorizationUrl(): Promise<{ url: string; codeVerifier: string }>
```

**Returns:**

- An object containing:
  - `url`: The authorization URL to redirect the user.
  - `codeVerifier`: The PKCE code verifier to be stored securely for later token exchange.

#### `handleCallback(code: string, codeVerifier: string)`

Exchanges the authorization code for access tokens.

```typescript
async handleCallback(code: string, codeVerifier: string): Promise<any>
```

**Parameters:**

- `code` (string): The authorization code received from the OAuth callback.
- `codeVerifier` (string): The PKCE code verifier stored during the authorization request.

**Returns:**

- An object containing access tokens (e.g., `access_token`, `refresh_token`).

#### `makeAuthenticatedRequest(method: string, url: string, accessToken: string, data?: any)`

Makes an authenticated HTTP request to a protected resource using the access token and DPoP proof.

```typescript
async makeAuthenticatedRequest(
  method: string,
  url: string,
  accessToken: string,
  data?: any
): Promise<any>
```

**Parameters:**

- `method` (string): HTTP method (e.g., `GET`, `POST`).
- `url` (string): The URL of the protected resource.
- `accessToken` (string): The OAuth access token.
- `data` (any, optional): The request payload for methods like `POST` or `PUT`.

**Returns:**

- The response data from the protected resource.

### Helper Functions

#### `generateJWKS()`

Generates a new JSON Web Key Set (JWKS) and private key for signing.

```typescript
import { generateJWKS } from 'bluesky-oauth-client';

async function setupJWKS() {
  const { jwks, privateKey } = await generateJWKS();

  // Save JWKS to a file or database
  fs.writeFileSync('jwks.json', JSON.stringify(jwks, null, 2));

  // Securely store `privateKey` for signing DPoP proofs
  fs.writeFileSync('privateKey.json', JSON.stringify(privateKey, null, 2));
}

setupJWKS();
```

**Returns:**

- An object containing:
  - `jwks`: The generated JWKS (public keys).
  - `privateKey`: The corresponding private key for signing.

#### `generateClientMetadata(options: ClientMetadataOptions)`

Generates the `client-metadata.json` object.

```typescript
import { generateClientMetadata } from 'bluesky-oauth-client';

const clientMetadata = generateClientMetadata({
  clientName: "Your App Name",
  redirectUris: ["https://yourapp.com/oauth/callback"],
  scopes: ["openid", "profile"],
  jwksUri: "https://yourapp.com/oauth/jwks.json"
});

// Save the client metadata to a file
fs.writeFileSync('client-metadata.json', JSON.stringify(clientMetadata, null, 2));
```

**Parameters:**

- `options`: An object containing:
  - `clientName` (string): The name of your application.
  - `redirectUris` (string[]): Array of redirect URIs.
  - `scopes` (string[], optional): Array of OAuth scopes. Defaults to `['openid', 'profile']`.
  - `jwksUri` (string): URL where `jwks.json` is hosted.

**Returns:**

- An object representing `client-metadata.json`.

### Security Considerations

Security is paramount when handling OAuth flows and sensitive user data. Below are key considerations to ensure your application remains secure:

- **Secure Storage of Private Keys:**
  - Never expose your `privateKey.json` publicly or commit it to version control systems.
  - Use secure storage solutions like environment variables, encrypted storage, or secret managers.

- **HTTPS Everywhere:**
  - Ensure that both `client-metadata.json` and `jwks.json` are hosted over HTTPS to prevent man-in-the-middle attacks.

- **Validate URLs:**
  - Use the `isValidUrl` function provided in the package to validate any URLs before making network requests.

- **Sanitize Inputs:**
  - Always sanitize user inputs using the `sanitizeString` function to prevent injection attacks.

- **Rate Limiting:**
  - Implement rate limiting using the `checkRateLimit` function to protect against DoS attacks.

- **Keep Dependencies Updated:**
  - Regularly update your package dependencies to patch known vulnerabilities. Use tools like `npm audit` to identify issues.

- **Handle Errors Securely:**
  - Avoid exposing sensitive error information to end-users. Provide generic error messages and log detailed errors internally.

- **Regular Security Audits:**
  - Periodically review your code and dependencies for security vulnerabilities.

## Contributing

Contributions are welcome! If you encounter issues or have suggestions for improvements, please open an issue or submit a pull request.

1. **Fork the Repository**
2. **Create a Feature Branch**
3. **Commit Your Changes**
4. **Push to the Branch**
5. **Open a Pull Request**

Please ensure that your contributions adhere to the project's coding standards and include appropriate tests.

## License

This project is licensed under the MIT License.
```
