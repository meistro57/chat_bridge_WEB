# Chat Bridge Testing Documentation

This document provides comprehensive information about the testing infrastructure for the Chat Bridge project.

## Overview

The Chat Bridge project uses a hybrid architecture with three main components:
1. **Frontend**: React + Vite + TypeScript
2. **Laravel Backend**: Authentication, persistence, and API management
3. **Python Backend**: AI conversation engine with FastAPI

## Test Coverage by Component

### 1. Laravel Backend Tests

**Location**: `laravel-backend/tests/`

#### Feature Tests (`tests/Feature/`)

##### AuthenticationTest.php
Tests JWT-based authentication system:
- ✅ User registration with validation
- ✅ Login/logout flows
- ✅ Token generation and validation
- ✅ Protected route access
- ✅ Email uniqueness and validation
- ✅ Password requirements (min 6 chars, confirmation)
- ✅ User profile retrieval

**Total: 14 test cases**

##### ConversationTest.php
Tests conversation management and Python backend integration:
- ✅ Starting conversations with personas
- ✅ Conversation continuation
- ✅ Persona creation and reuse
- ✅ Provider validation
- ✅ Temperature and model validation
- ✅ Max rounds limits (1-20)
- ✅ Default value handling
- ✅ API key injection
- ✅ Provider status checking
- ✅ Relationship handling with personas

**Total: 18 test cases**

##### PersonaTest.php
Tests persona CRUD operations:
- ✅ List all personas
- ✅ Create persona with validation
- ✅ Name uniqueness enforcement
- ✅ Required fields (name, provider, system_prompt)
- ✅ Temperature range validation (0-1)
- ✅ Optional fields handling
- ✅ Guidelines array storage
- ✅ Show specific persona
- ✅ 404 handling for non-existent personas

**Total: 11 test cases**

#### Unit Tests (`tests/Unit/`)

##### ChatBridgeServiceTest.php
Tests HTTP client service for Python backend communication:
- ✅ Payload construction for backend
- ✅ Message storage in database
- ✅ WebSocket event broadcasting
- ✅ Conversation initiation
- ✅ Conversation continuation
- ✅ Error handling for backend failures
- ✅ Optional field handling
- ✅ Empty message arrays

**Total: 9 test cases**

##### ModelTest.php
Tests Eloquent models and relationships:
- ✅ User model with JWT implementation
- ✅ Persona model with array/float casting
- ✅ Conversation model with relationships
- ✅ Message model with metadata
- ✅ BelongsTo relationships (Conversation → Persona)
- ✅ HasMany relationships (Conversation → Messages)
- ✅ Eager loading
- ✅ Fillable attributes
- ✅ Hidden attributes (password)

**Total: 19 test cases**

**Laravel Total: 71 test cases**

### 2. Python Backend Tests

**Location**: `backend/tests/`

#### test_main.py
Unit tests using FastAPI TestClient:
- ✅ Health endpoint
- ✅ Persona listing
- ✅ Conversation creation
- ✅ Middleware functionality

#### integration_test.py
Integration tests:
- ✅ Full backend functionality
- ✅ API key injection
- ✅ Model resolution
- ✅ Provider status checking

**Python Total: ~15 test cases (existing)**

### 3. Frontend Tests

**Location**: `frontend/src/`

**Status**: ⚠️ No tests currently implemented

**Recommendation**: Add tests using:
- Vitest for unit testing
- React Testing Library for component tests
- Playwright/Cypress for E2E tests

## Running Tests

### Laravel Tests

```bash
cd laravel-backend

# Run all tests
composer test
# or
php artisan test

# Run with detailed output
php artisan test --testdox

# Run specific suite
php artisan test --testsuite=Feature
php artisan test --testsuite=Unit

# Run specific test file
php artisan test --filter=AuthenticationTest

# Run with coverage
composer test-coverage
```

### Python Tests

```bash
cd backend

# Run all tests
pytest tests/ -v

# Run with coverage
pytest tests/ --cov=. --cov-report=html

# Run specific test file
pytest tests/test_main.py -v
```

### Frontend Tests

```bash
cd frontend

# Install dependencies (if not already installed)
npm install

# Run tests (when implemented)
npm test

# Run with coverage
npm test -- --coverage
```

## Linting

Use the combined lint script to run Ruff for the Python backend and ESLint for the frontend:

```bash
./lint.sh
```

## CI/CD Integration

### GitHub Actions Workflows

Three workflows are configured in `.github/workflows/`:

#### 1. laravel-tests.yml
- **Triggers**: Push/PR to main, develop, claude/** branches
- **Matrix**: PHP 8.1, 8.2, 8.3
- **Steps**:
  1. Checkout code
  2. Setup PHP with extensions
  3. Cache Composer dependencies
  4. Install dependencies
  5. Setup environment (.env)
  6. Run migrations
  7. Execute tests
  8. Generate coverage (PHP 8.2 only)
  9. Upload to Codecov

#### 2. python-tests.yml
- **Triggers**: Push/PR to main, develop, claude/** branches
- **Matrix**: Python 3.9, 3.10, 3.11
- **Steps**:
  1. Checkout code
  2. Setup Python
  3. Cache pip dependencies
  4. Install dependencies
  5. Run tests
  6. Generate coverage (Python 3.10 only)
  7. Upload to Codecov

#### 3. frontend-tests.yml
- **Triggers**: Push/PR to main, develop, claude/** branches
- **Matrix**: Node 18.x, 20.x
- **Steps**:
  1. Checkout code
  2. Setup Node.js
  3. Cache node modules
  4. Install dependencies
  5. Run linter
  6. Build application
  7. Run tests (when implemented)

## Test Database Configuration

### Laravel

Tests use in-memory SQLite database (configured in `phpunit.xml`):

```xml
<env name="DB_CONNECTION" value="sqlite"/>
<env name="DB_DATABASE" value=":memory:"/>
```

Benefits:
- Fast test execution
- No cleanup required
- Isolated test environment

### Python

Tests use mocked dependencies and fixtures:
- FastAPI TestClient for API testing
- Pytest fixtures for setup/teardown
- Monkeypatching for external dependencies

## Test Factories

Laravel includes database factories for all models:

```php
// User factory
User::factory()->create([
    'email' => 'test@example.com',
    'password' => Hash::make('password'),
]);

// Persona factory
Persona::factory()->create([
    'name' => 'Custom Assistant',
    'provider' => 'openai',
]);

// Conversation factory
Conversation::factory()->create([
    'provider_a' => 'openai',
    'provider_b' => 'anthropic',
]);

// Message factory
Message::factory()->create([
    'conversation_id' => $conversation->id,
    'content' => 'Test message',
]);
```

## Coverage Goals

### Current Coverage (Estimated)

- **Laravel Backend**: ~85% (71 test cases covering all major features)
- **Python Backend**: ~70% (existing tests)
- **Frontend**: 0% (no tests)

### Target Coverage

- **Laravel Backend**: 90%+
- **Python Backend**: 85%+
- **Frontend**: 80%+

## Testing Best Practices

1. **Write tests first** when adding new features (TDD)
2. **Use factories** for model creation in tests
3. **Mock external dependencies** (HTTP clients, API calls)
4. **Test edge cases** and error conditions
5. **Keep tests isolated** - no dependencies between tests
6. **Use descriptive test names** - `test_user_can_register_with_valid_credentials`
7. **Test one thing per test** - single assertion focus
8. **Clean up after tests** - use RefreshDatabase trait in Laravel

## Adding New Tests

### Laravel Feature Test Example

```php
/** @test */
public function new_feature_works_correctly()
{
    // Arrange
    $user = User::factory()->create();

    // Act
    $response = $this->actingAs($user)
        ->postJson('/api/endpoint', ['data' => 'value']);

    // Assert
    $response->assertStatus(200)
        ->assertJson(['success' => true]);
}
```

### Laravel Unit Test Example

```php
/** @test */
public function service_method_returns_expected_result()
{
    // Arrange
    $service = new MyService();

    // Act
    $result = $service->performAction('input');

    // Assert
    $this->assertEquals('expected', $result);
}
```

## Continuous Improvement

### Next Steps

1. ✅ Complete Laravel test suite (DONE)
2. ⏳ Add frontend test suite (Vitest + React Testing Library)
3. ⏳ Increase Python test coverage
4. ⏳ Add E2E tests (Playwright/Cypress)
5. ⏳ Setup test coverage reporting dashboard
6. ⏳ Add performance testing
7. ⏳ Add security testing (OWASP)

## Resources

- [Laravel Testing Documentation](https://laravel.com/docs/10.x/testing)
- [PHPUnit Documentation](https://phpunit.de/documentation.html)
- [Pytest Documentation](https://docs.pytest.org/)
- [React Testing Library](https://testing-library.com/react)
- [Vitest](https://vitest.dev/)

## Contact

For questions about testing or to report issues:
- Create an issue at: https://github.com/meistro57/chat_bridge_WEB/issues
- Review PRs in the repository

---

**Last Updated**: 2026-01-19
**Test Suite Version**: 1.0.0
**Total Test Cases**: 86+ (71 Laravel + 15 Python)
