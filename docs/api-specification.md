# API Specification

## Base URL
`/api/v1`

## Standard Envelopes

### Success
```json
{
  "success": true,
  "data": {}
}
```

### Error
```json
{
  "success": false,
  "error": {
    "code": "STRING_ERROR_CODE",
    "message": "Human readable message",
    "details": null
  }
}
```

## Endpoints

### 1. Create Short URL
- **POST** `/api/v1/urls`
- **Body**:
  ```json
  {
    "originalUrl": "https://example.com/test",
    "expiresAt": "2026-12-31T23:59:59.000Z" // optional
  }
  ```
- **Response (201 Created)**:
  ```json
  {
    "success": true,
    "data": {
      "shortCode": "k9xL2pQ",
      "shortUrl": "http://localhost:3000/k9xL2pQ",
      "originalUrl": "https://example.com/test",
      "createdAt": "2026-11-04T12:00:00.000Z",
      "expiresAt": "2026-12-31T23:59:59.000Z"
    }
  }
  ```

### 2. Redirect to Original Destination
- **GET** `/:shortCode`
- **Response (302 Found)**:
  - Header: `Location: https://example.com/test`

### 3. Get URL Details
- **GET** `/api/v1/urls/:shortCode`
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "shortCode": "k9xL2pQ",
      "shortUrl": "http://localhost:3000/k9xL2pQ",
      "originalUrl": "https://example.com/test",
      "isActive": true,
      "createdAt": "2026-11-04T12:00:00.000Z",
      "updatedAt": "2026-11-04T12:00:00.000Z",
      "expiresAt": "2026-12-31T23:59:59.000Z"
    }
  }
  ```

### 4. Get URL Statistics
- **GET** `/api/v1/urls/:shortCode/stats`
- **Auth**: requires `x-api-key` header or `Authorization: Bearer <key>`
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "shortCode": "k9xL2pQ",
      "totalClicks": 12,
      "createdAt": "2026-11-04T12:00:00.000Z",
      "lastClickedAt": "2026-11-04T12:45:00.000Z",
      "expiresAt": "2026-12-31T23:59:59.000Z",
      "isActive": true
    }
  }
  ```

### 5. Deactivate / Delete URL
- **DELETE** `/api/v1/urls/:shortCode`
- **Headers**: `x-api-key: <ADMIN_API_KEY>`
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "message": "URL has been successfully deactivated.",
      "shortCode": "k9xL2pQ"
    }
  }
  ```

### 6. Health & Readiness Probes
- **GET** `/health` (Liveness)
- **GET** `/ready` (Readiness)

