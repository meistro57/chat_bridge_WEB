# Chat Bridge Laravel Backend

The Laravel backend serves as a platform layer for the Chat Bridge application, providing authentication, persistence, and API management for the Python AI backend.

## Architecture

This is a **Hybrid Platform** where Laravel wraps the Python FastAPI backend:

```
Frontend → Laravel (Port 8001) → Python Backend (Port 8000) → LLM Providers
```

## Features

- **JWT Authentication**: Secure user authentication with token-based auth
- **Conversation Management**: Create and manage AI conversations between multiple providers
- **Persona System**: Define and manage AI personas with custom prompts and settings
- **Message History**: Store and retrieve conversation messages with metadata
- **API Key Management**: Securely handle API keys for multiple AI providers
- **WebSocket Events**: Real-time updates via broadcasting

## Requirements

- PHP 8.1 or higher
- Composer
- Laravel 10.x
- SQLite/MySQL/PostgreSQL

## Installation

1. Install dependencies:
```bash
cd laravel-backend
composer install
```

2. Set up environment:
```bash
cp .env.example .env
php artisan key:generate
```

3. Configure database in `.env`:
```env
DB_CONNECTION=sqlite
DB_DATABASE=/path/to/database.sqlite
```

4. Run migrations:
```bash
php artisan migrate
```

5. Start the server:
```bash
php artisan serve --port=8001
```

## Testing

The Laravel backend includes comprehensive test coverage:

### Test Structure

- **Feature Tests**: Test API endpoints and integrations
  - `AuthenticationTest.php` - JWT authentication flows
  - `ConversationTest.php` - Conversation management
  - `PersonaTest.php` - Persona CRUD operations

- **Unit Tests**: Test individual components
  - `ChatBridgeServiceTest.php` - HTTP client service
  - `ModelTest.php` - Model relationships and behaviors

### Running Tests

Run all tests:
```bash
composer test
# or
php artisan test
```

Run specific test suite:
```bash
php artisan test --testsuite=Feature
php artisan test --testsuite=Unit
```

Run specific test file:
```bash
php artisan test --filter=AuthenticationTest
```

Run with coverage:
```bash
composer test-coverage
```

### Test Database

Tests use an in-memory SQLite database by default (configured in `phpunit.xml`):

```xml
<env name="DB_CONNECTION" value="sqlite"/>
<env name="DB_DATABASE" value=":memory:"/>
```

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get authenticated user

### Conversations

- `POST /api/conversations` - Start new conversation
- `POST /api/conversations/continue` - Continue conversation
- `POST /api/provider-status` - Check provider availability

### Personas

- `GET /api/personas` - List all personas
- `POST /api/personas` - Create new persona
- `GET /api/personas/{id}` - Get specific persona

## Models

### User
- JWT authentication support
- Standard Laravel user model

### Persona
- AI assistant configuration
- Provider, model, temperature settings
- System prompts and guidelines

### Conversation
- Links two personas for dialogue
- Provider and model configuration
- Max rounds and temperature settings
- Relationships: `personaA()`, `personaB()`, `messages()`

### Message
- Individual conversation messages
- Metadata: tokens, response time, model
- Relationship: `conversation()`

## Services

### ChatBridgeService

HTTP client service that communicates with the Python backend:

- `initiateConversation(Conversation)` - Start new conversation
- `continueConversation(Conversation, $message)` - Add message to conversation
- Stores messages in database
- Broadcasts WebSocket events

## CI/CD

GitHub Actions workflows are configured for:

- **Laravel Tests**: Runs on PHP 8.1, 8.2, 8.3
- **Python Tests**: Runs Python backend tests
- **Frontend Tests**: Runs frontend build and tests

Workflows trigger on:
- Push to `main`, `develop`, `claude/**` branches
- Pull requests to `main`, `develop`

## Development

### Database Factories

All models have factories for testing:

```php
User::factory()->create();
Persona::factory()->create(['name' => 'Custom']);
Conversation::factory()->create();
Message::factory()->create();
```

### Running Migrations

```bash
php artisan migrate
php artisan migrate:fresh --seed
```

## Configuration

Key configuration values in `.env`:

- `PYTHON_BACKEND_URL` - Python FastAPI backend URL (default: http://localhost:8000)
- `JWT_SECRET` - Secret key for JWT tokens
- `JWT_TTL` - Token lifetime in minutes (default: 60)
- Provider API keys: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc.

## License

MIT
