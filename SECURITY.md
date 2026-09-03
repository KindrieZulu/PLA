# PLA Security Implementation Guide

## Overview

This document outlines the security measures implemented in the PLA (Personalised Learning Assistant) system.

## 🔒 Security Features Implemented

### 1. Authentication & Authorization

#### JWT Token Security
- **Access tokens**: 15-minute expiry, stored in memory (NOT localStorage)
- **Refresh tokens**: 7-day expiry, rotated on use, stored server-side in Redis/PostgreSQL
- **Token revocation**: Supported via Redis blacklist (`revoked:{jti}`)
- **JWT ID (jti)**: Unique identifier for each token enabling revocation

#### Password Security
- **Bcrypt hashing**: Minimum 12 rounds
- **Password requirements**: 8+ chars, uppercase, lowercase, number
- **Account lockout**: 5 failed attempts → 15-minute lockout
- **Secure storage**: Passwords never logged or exposed

#### Role-Based Access Control
```
Admin (level 4) → Full access
Teacher (level 3) → Class management, student data
Student (level 2) → Own data only
Guest (level 1) → Limited read access
```

### 2. API Security

#### Rate Limiting
| Endpoint | Limit | Window |
|----------|-------|--------|
| Global `/api` | 300 req | 15 min |
| Auth routes | 10 req | 15 min |
| Admin routes | 30 req | 1 min |
| Quiz submissions | 30 req | 1 min |
| Bulk sync | 5 req | 1 min |

**Implementation**: Redis-backed for distributed deployment

#### Input Validation
- All user inputs validated using `express-validator`
- SQL parameterization prevents injection
- XSS protection via `xss-clean` middleware
- Body size limits (1MB JSON, 100 form fields)

#### Security Headers (Helmet.js)
- `Content-Security-Policy` - Prevents XSS/injection
- `X-Content-Type-Options` - MIME sniffing protection
- `X-Frame-Options` - Clickjacking prevention
- `Strict-Transport-Security` - HTTPS enforcement
- `X-XSS-Protection` - Legacy XSS filter

### 3. Token Handling (Frontend Security)

**IMPORTANT**: Tokens are NOT stored in localStorage or sessionStorage.

#### Secure Token Management
```javascript
// Tokens sent via HTTP-only cookies (recommended)
// or kept in memory only

// Login response contains user data only
{
  accessToken: "...", // For API calls
  refreshToken: "...", // For token refresh
  user: { id, username, firstName, lastName, role }
}

// API calls include token in Authorization header
Authorization: Bearer <token>
```

#### Token Refresh Flow
1. Request fails with 401 + `TOKEN_EXPIRED`
2. Client calls `/auth/refresh` with refresh token
3. Server validates refresh token
4. New access token returned
5. Original request retried with new token

### 4. Database Security

#### PostgreSQL
- All queries use parameterized statements
- Connection pooling with limited connections
- Soft delete pattern (no hard deletes)
- Audit logging for sensitive operations

#### MongoDB
- Schema-based with Mongoose
- Indexed for performance
- Separate collections for time-series data

### 5. Infrastructure Security

#### Network Policies (Kubernetes)
```yaml
# Only allow traffic from web app and ingress
ingress:
  - from:
      - podSelector:
          matchLabels:
            app: pla-web
      - podSelector:
          matchLabels:
            app: nginx-ingress

# Limit egress to required services
egress:
  - to: [postgres, redis, mongodb]
  - to: [DNS namespace]
```

#### Container Security
- Non-root user (UID 1001)
- Read-only filesystem
- Dropped capabilities
- Resource limits

### 6. Observability & Monitoring

#### Logging
- **Format**: JSON structured logs
- **Levels**: error, warn, info, http, debug, trace
- **Outputs**: Console + file (error.log, combined.log, security.log)
- **Security events**: Login, logout, token refresh, rate limits

#### Metrics (Prometheus)
- HTTP request count/duration
- Error rates by type
- Database query duration
- Cache hit/miss rates
- Rate limit hits
- Auth attempts

#### Alerts
- High error rate (>5%)
- Slow response time (p95 >2s)
- Authentication failures
- Rate limit exceeded
- Database connection exhaustion

### 7. Error Tracking

#### Sentry Integration
- Automatic error capture
- Stack traces for debugging
- Performance monitoring
- Release tracking

## 🚀 Production Checklist

### Before Deployment

1. **Environment Variables**
   ```bash
   # Generate secure secrets
   openssl rand -base64 32  # For JWT_SECRET
   openssl rand -base64 32  # For SESSION_SECRET
   
   # Configure all required variables in .env
   # Set NODE_ENV=production
   ```

2. **Secrets Management**
   - [ ] Use Kubernetes Secrets or Vault
   - [ ] Rotate secrets regularly
   - [ ] Never commit secrets to git

3. **TLS Configuration**
   - [ ] Enable HTTPS everywhere
   - [ ] Configure HSTS headers
   - [ ] Use strong TLS (1.2+)

4. **Monitoring**
   - [ ] Verify Prometheus scrapes targets
   - [ ] Check Grafana dashboards load
   - [ ] Configure alert notifications
   - [ ] Test alerting triggers

5. **Security Scan**
   ```bash
   ./scripts/security-audit.sh
   ```

## 📊 Security Metrics

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Availability | 99.9% | <99.5% |
| Error Rate | <1% | >5% |
| p95 Latency | <500ms | >2s |
| Auth Failures | <1% | >10% |

## 🔐 Encryption

| Data | At Rest | In Transit |
|------|---------|------------|
| Passwords | bcrypt | TLS |
| JWT Tokens | - | TLS |
| DB Connections | - | TLS (if configured) |
| Redis Connections | - | TLS (if configured) |

## 📝 Security Headers Reference

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
```

## 🛡️ Attack Mitigation

### SQL Injection
- Parameterized queries in all database operations
- Input validation before query execution
- No dynamic SQL construction from user input

### XSS
- `xss-clean` middleware sanitizes input
- `helmet` CSP headers restrict script execution
- React auto-escapes output
- Content sanitization for user-generated content

### CSRF
- `hpp` prevents parameter pollution
- CSRF tokens for state-changing operations
- SameSite cookies (when implemented)

### Brute Force
- Rate limiting on auth endpoints
- Account lockout after 5 failed attempts
- IP-based temporary blocks

### DoS/DDoS
- Global rate limiting (300 req/15min)
- Per-endpoint rate limits
- Connection timeouts
- Request body size limits

## 📞 Security Incident Response

1. **Identify**: Check logs, metrics, alerts
2. **Contain**: Block IP, revoke tokens, disable account
3. **Eradicate**: Patch vulnerability, remove malware
4. **Recover**: Restore service, verify integrity
5. **Post-mortem**: Document, fix root cause, update monitoring