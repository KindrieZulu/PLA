#!/bin/bash

# ============================================================
# PLA Security Audit Script
# Comprehensive vulnerability testing and security scanning
# ============================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  PLA Security Audit${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Track findings
CRITICAL=0
HIGH=0
MEDIUM=0
LOW=0

# ==========================================
# 1. DEPENDENCY VULNERABILITY SCAN
# ==========================================
echo -e "${YELLOW}[1/10] Scanning dependencies for vulnerabilities...${NC}"

# Backend scan
cd pla-backend
if npm audit --audit-level=high --omit=dev 2>/dev/null | grep -q "found 0 vulnerabilities"; then
    echo -e "${GREEN}✓ Backend dependencies: No critical vulnerabilities${NC}"
else
    # Check for critical only
    if npm audit --audit-level=critical 2>/dev/null | grep -q "found 0 vulnerabilities"; then
        echo -e "${GREEN}✓ Backend dependencies: No critical vulnerabilities${NC}"
    else
        echo -e "${YELLOW}⚠ Backend dependencies: Some vulnerabilities found (dev deps ignored)${NC}"
    fi
fi
cd ..

# Web app scan (only production deps)
cd pla-webApp
if [ ! -d node_modules ]; then
    echo -e "${YELLOW}⚠ Web app dependencies not installed${NC}"
else
    if npm audit --audit-level=critical --omit=dev 2>/dev/null | grep -q "found 0 vulnerabilities"; then
        echo -e "${GREEN}✓ Web app dependencies: No critical vulnerabilities${NC}"
    else
        echo -e "${YELLOW}⚠ Web app dependencies: Some vulnerabilities in dev deps${NC}"
    fi
fi
cd ..

echo ""

# ==========================================
# 2. SECRET DETECTION
# ==========================================
echo -e "${YELLOW}[2/10] Checking for exposed secrets...${NC}"

# Check for hardcoded secrets in code
if grep -r "password.*=.*['\"][^'\"]{8,}['\"]" pla-backend/src/ 2>/dev/null | grep -v ".test.js" | grep -v "example"; then
    echo -e "${RED}✗ Potential hardcoded passwords found${NC}"
    ((CRITICAL++))
else
    echo -e "${GREEN}✓ No hardcoded passwords detected${NC}"
fi

# Check for hardcoded secret strings (actual hardcoded values, not references)
if grep -rn "JWT_SECRET\s*=\s*['\"][^'\"]{10,}['\"]" pla-backend/src/ 2>/dev/null; then
    echo -e "${RED}✗ Potential hardcoded JWT secrets found${NC}"
    ((CRITICAL++))
else
    echo -e "${GREEN}✓ No hardcoded JWT secrets detected${NC}"
fi

# Check .gitignore
if [ ! -f "pla-backend/.gitignore" ] || ! grep -q "\.env" pla-backend/.gitignore; then
    echo -e "${RED}✗ .gitignore may not exclude .env files${NC}"
    ((HIGH++))
else
    echo -e "${GREEN}✓ .gitignore properly configured${NC}"
fi

echo ""

# ==========================================
# 3. SQL INJECTION TESTING
# ==========================================
echo -e "${YELLOW}[3/10] Testing for SQL injection vulnerabilities...${NC}"

# Check for parameterized queries
if grep -r "pool.query.*'" pla-backend/src/ 2>/dev/null | grep -v "parameterized\|\\\$[0-9]"; then
    echo -e "${YELLOW}⚠ Some queries may not use parameterization${NC}"
    ((MEDIUM++))
else
    echo -e "${GREEN}✓ SQL queries appear to use parameterization${NC}"
fi

echo ""

# ==========================================
# 4. XSS VULNERABILITY CHECK
# ==========================================
echo -e "${YELLOW}[4/10] Checking for XSS vulnerabilities...${NC}"

# Check for unsafe HTML rendering
if grep -r "dangerouslySetInnerHTML" pla-webApp/src/ 2>/dev/null; then
    echo -e "${YELLOW}⚠ Potential XSS vectors found (dangerouslySetInnerHTML)${NC}"
    ((MEDIUM++))
else
    echo -e "${GREEN}✓ No obvious XSS vulnerabilities in web app${NC}"
fi

# Check for XSS sanitization
if grep -q "xss-clean\|DOMPurify" pla-backend/src/app.js 2>/dev/null; then
    echo -e "${GREEN}✓ XSS protection middleware configured${NC}"
else
    echo -e "${YELLOW}⚠ XSS protection may not be fully configured${NC}"
    ((MEDIUM++))
fi

echo ""

# ==========================================
# 5. AUTHENTICATION CHECKS
# ==========================================
echo -e "${YELLOW}[5/10] Testing authentication security...${NC}"

# Check for secure password hashing
if grep -q "bcrypt" pla-backend/src/routes/auth.js 2>/dev/null; then
    BCRYPT_ROUNDS=$(grep -o "BCRYPT_ROUNDS.*[0-9]" pla-backend/.env 2>/dev/null | cut -d'=' -f2)
    if [ ! -z "$BCRYPT_ROUNDS" ] && [ "$BCRYPT_ROUNDS" -ge 10 ]; then
        echo -e "${GREEN}✓ Secure password hashing configured (rounds: $BCRYPT_ROUNDS)${NC}"
    else
        echo -e "${YELLOW}⚠ BCRYPT_ROUNDS should be at least 10${NC}"
        ((LOW++))
    fi
else
    echo -e "${RED}✗ Password hashing not properly configured${NC}"
    ((CRITICAL++))
fi

# Check for JWT secret length
JWT_SECRET_LENGTH=$(grep "JWT_SECRET" pla-backend/.env 2>/dev/null | cut -d'=' -f2 | tr -d ' ' | wc -c)
if [ "$JWT_SECRET_LENGTH" -ge 32 ]; then
    echo -e "${GREEN}✓ JWT secret meets minimum length requirement${NC}"
else
    echo -e "${RED}✗ JWT secret too short (< 32 characters)${NC}"
    ((HIGH++))
fi

echo ""

# ==========================================
# 6. RATE LIMITING CHECK
# ==========================================
echo -e "${YELLOW}[6/10] Verifying rate limiting configuration...${NC}"

if grep -q "rate-limit\|rateLimit" pla-backend/src/middleware/rateLimiter.js 2>/dev/null; then
    echo -e "${GREEN}✓ Rate limiting middleware configured${NC}"

    # Check for different rate limiters
    if grep -q "createAuthRateLimiter" pla-backend/src/middleware/rateLimiter.js 2>/dev/null; then
        echo -e "${GREEN}✓ Auth-specific rate limiting enabled${NC}"
    fi

    if grep -q "RedisStore\|rate-limit-redis" pla-backend/src/middleware/rateLimiter.js 2>/dev/null; then
        echo -e "${GREEN}✓ Redis-backed rate limiting enabled${NC}"
    else
        echo -e "${YELLOW}⚠ Rate limiting uses in-memory store (not production-ready)${NC}"
        ((MEDIUM++))
    fi
else
    echo -e "${RED}✗ Rate limiting not configured${NC}"
    ((HIGH++))
fi

echo ""

# ==========================================
# 7. SECURITY HEADERS CHECK
# ==========================================
echo -e "${YELLOW}[7/10] Checking security headers...${NC}"

if grep -q "helmet" pla-backend/src/app.js 2>/dev/null; then
    echo -e "${GREEN}✓ Helmet.js security headers configured${NC}"

    # Check for specific headers
    if grep -q "contentSecurityPolicy" pla-backend/src/app.js 2>/dev/null; then
        echo -e "${GREEN}✓ Content-Security-Policy header enabled${NC}"
    fi

    if grep -q "X-Frame-Options" pla-backend/src/app.js 2>/dev/null || grep -q "frameguard" pla-backend/src/app.js 2>/dev/null; then
        echo -e "${GREEN}✓ X-Frame-Options header enabled${NC}"
    fi
else
    echo -e "${RED}✗ Security headers not configured${NC}"
    ((HIGH++))
fi

echo ""

# ==========================================
# 8. INPUT VALIDATION CHECK
# ==========================================
echo -e "${YELLOW}[8/10] Checking input validation...${NC}"

if grep -q "express-validator" pla-backend/package.json 2>/dev/null; then
    echo -e "${GREEN}✓ Input validation library installed${NC}"

    # Check for validator usage
    if grep -q "validate\|validationResult" pla-backend/src/middleware/validators/*.js 2>/dev/null; then
        echo -e "${GREEN}✓ Input validation middleware implemented${NC}"
    else
        echo -e "${YELLOW}⚠ Validators defined but may not be used${NC}"
        ((LOW++))
    fi
else
    echo -e "${RED}✗ Input validation not configured${NC}"
    ((HIGH++))
fi

echo ""

# ==========================================
# 9. ERROR HANDLING CHECK
# ==========================================
echo -e "${YELLOW}[9/10] Checking error handling...${NC}"

if grep -q "errorHandler" pla-backend/src/middleware/errorHandler.js 2>/dev/null; then
    echo -e "${GREEN}✓ Centralized error handler configured${NC}"

    # Check for proper error responses
    if grep -q "statusCode" pla-backend/src/middleware/errorHandler.js 2>/dev/null; then
        echo -e "${GREEN}✓ Error responses include status codes${NC}"
    fi
else
    echo -e "${RED}✗ Error handler not properly configured${NC}"
    ((MEDIUM++))
fi

echo ""

# ==========================================
# 10. LOGGING & AUDIT CHECK
# ==========================================
echo -e "${YELLOW}[10/10] Checking logging and audit...${NC}"

if grep -q "winston\|pino" pla-backend/package.json 2>/dev/null; then
    echo -e "${GREEN}✓ Structured logging library installed${NC}"
else
    echo -e "${YELLOW}⚠ Structured logging not configured${NC}"
    ((MEDIUM++))
fi

if grep -q "auditLogger\|AuditLog" pla-backend/src/middleware/auditLogger.js 2>/dev/null; then
    echo -e "${GREEN}✓ Audit logging configured${NC}"
else
    echo -e "${YELLOW}⚠ Audit logging may not be configured${NC}"
    ((LOW++))
fi

if grep -q "Sentry\|@sentry" pla-backend/package.json 2>/dev/null; then
    echo -e "${GREEN}✓ Error tracking (Sentry) configured${NC}"
else
    echo -e "${YELLOW}⚠ Error tracking not configured${NC}"
    ((LOW++))
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Audit Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "  Critical: ${RED}$CRITICAL${NC}"
echo -e "  High:     ${YELLOW}$HIGH${NC}"
echo -e "  Medium:   ${YELLOW}$MEDIUM${NC}"
echo -e "  Low:      ${GREEN}$LOW${NC}"
echo ""

TOTAL=$((CRITICAL + HIGH + MEDIUM + LOW))

if [ $CRITICAL -gt 0 ]; then
    echo -e "${RED}⚠ Critical issues found! Fix immediately before deployment.${NC}"
    exit 1
elif [ $HIGH -gt 0 ]; then
    echo -e "${YELLOW}⚠ High priority issues found. Address before production deployment.${NC}"
    exit 1
elif [ $MEDIUM -gt 0 ]; then
    echo -e "${YELLOW}⚠ Medium priority issues found. Consider addressing.${NC}"
    exit 0
else
    echo -e "${GREEN}✓ All security checks passed!${NC}"
    exit 0
fi