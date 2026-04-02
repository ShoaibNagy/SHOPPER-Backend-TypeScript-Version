import swaggerJsdoc from 'swagger-jsdoc';
import { env } from './env';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Shopper E-Commerce API',
      version: '1.0.0',
      description:
        'Complete REST API for the Shopper e-commerce platform. ' +
        'Provides endpoints for authentication, products, orders, cart, payments, and reviews.',
      contact: { name: 'API Support', email: 'support@shopper.com' },
    },
    servers: [
      { url: `http://localhost:${env.node.port}`, description: 'Development server' },
      { url: 'https://api.shopper.com',           description: 'Production server'  },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http', scheme: 'bearer', bearerFormat: 'JWT',
          description: 'JWT token from /api/auth/login or /api/auth/signup',
        },
      },
      schemas: {
        // ── Shared ────────────────────────────────────────────────────────────
        ApiResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data:    { type: 'object', nullable: true },
          },
        },
        PaginatedResult: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: { type: 'array', items: { type: 'object' } },
            pagination: {
              type: 'object',
              properties: {
                total:       { type: 'integer', example: 100 },
                page:        { type: 'integer', example: 1 },
                limit:       { type: 'integer', example: 20 },
                totalPages:  { type: 'integer', example: 5 },
                hasNextPage: { type: 'boolean', example: true },
                hasPrevPage: { type: 'boolean', example: false },
              },
            },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'An error occurred' },
          },
        },
        // ── Auth ──────────────────────────────────────────────────────────────
        SignupRequest: {
          type: 'object', required: ['username', 'email', 'password'],
          properties: {
            username: { type: 'string', minLength: 3, maxLength: 30, example: 'johndoe' },
            email:    { type: 'string', format: 'email', example: 'john@example.com' },
            password: { type: 'string', minLength: 8, example: 'Password1', description: 'Must contain uppercase, lowercase, and a number' },
          },
        },
        LoginRequest: {
          type: 'object', required: ['email', 'password'],
          properties: {
            email:    { type: 'string', format: 'email', example: 'john@example.com' },
            password: { type: 'string', example: 'Password1' },
          },
        },
        AuthResponse: {
          type: 'object',
          properties: {
            token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIs...' },
            user: {
              type: 'object',
              properties: {
                id:       { type: 'string', example: '64b1f2c3d4e5f6a7b8c9d0e1' },
                username: { type: 'string', example: 'johndoe' },
                email:    { type: 'string', example: 'john@example.com' },
                role:     { type: 'string', enum: ['user', 'admin'], example: 'user' },
              },
            },
          },
        },
        // ── User ──────────────────────────────────────────────────────────────
        UserResponse: {
          type: 'object',
          properties: {
            id:        { type: 'string', example: '64b1f2c3d4e5f6a7b8c9d0e1' },
            username:  { type: 'string', example: 'johndoe' },
            email:     { type: 'string', example: 'john@example.com' },
            role:      { type: 'string', enum: ['user', 'admin'] },
            isActive:  { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        UpdateProfileRequest: {
          type: 'object',
          properties: {
            username: { type: 'string', minLength: 3, maxLength: 30 },
            email:    { type: 'string', format: 'email' },
          },
        },
        ChangePasswordRequest: {
          type: 'object', required: ['currentPassword', 'newPassword'],
          properties: {
            currentPassword: { type: 'string', example: 'OldPassword1' },
            newPassword:     { type: 'string', example: 'NewPassword1', description: 'Min 8 chars, uppercase + lowercase + number, must differ from current' },
          },
        },
        // ── Product ───────────────────────────────────────────────────────────
        ProductResponse: {
          type: 'object',
          properties: {
            id:        { type: 'string', example: '64b1f2c3d4e5f6a7b8c9d0e1' },
            name:      { type: 'string', example: 'Classic Leather Jacket' },
            image:     { type: 'string', format: 'uri', example: 'http://localhost:4000/images/jacket.png' },
            category:  { type: 'string', enum: ['men', 'women', 'kids'] },
            new_price: { type: 'number', example: 49.99 },
            old_price: { type: 'number', example: 79.99 },
            available: { type: 'boolean', example: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        CreateProductRequest: {
          type: 'object', required: ['name', 'image', 'category', 'new_price', 'old_price'],
          properties: {
            name:      { type: 'string', maxLength: 200, example: 'Classic Leather Jacket' },
            image:     { type: 'string', format: 'uri', example: 'http://localhost:4000/images/jacket.png' },
            category:  { type: 'string', enum: ['men', 'women', 'kids'], example: 'women' },
            new_price: { type: 'number', minimum: 0, example: 49.99 },
            old_price: { type: 'number', minimum: 0, example: 79.99 },
          },
        },
        UpdateProductRequest: {
          type: 'object',
          properties: {
            name:      { type: 'string', maxLength: 200 },
            image:     { type: 'string', format: 'uri' },
            category:  { type: 'string', enum: ['men', 'women', 'kids'] },
            new_price: { type: 'number', minimum: 0 },
            old_price: { type: 'number', minimum: 0 },
            available: { type: 'boolean' },
          },
        },
        // ── Cart ──────────────────────────────────────────────────────────────
        CartItem: {
          type: 'object',
          properties: {
            productId: { type: 'string', example: '64b1f2c3d4e5f6a7b8c9d0e1' },
            name:      { type: 'string', example: 'Classic Leather Jacket' },
            image:     { type: 'string', format: 'uri' },
            new_price: { type: 'number', example: 49.99 },
            quantity:  { type: 'integer', example: 2 },
            subtotal:  { type: 'number', example: 99.98 },
          },
        },
        CartResponse: {
          type: 'object',
          properties: {
            items:      { type: 'array', items: { '$ref': '#/components/schemas/CartItem' } },
            totalItems: { type: 'integer', example: 3 },
            totalPrice: { type: 'number', example: 149.97 },
          },
        },
        AddToCartRequest: {
          type: 'object', required: ['productId'],
          properties: {
            productId: { type: 'string', example: '64b1f2c3d4e5f6a7b8c9d0e1' },
            quantity:  { type: 'integer', minimum: 1, default: 1, example: 2 },
          },
        },
        UpdateCartItemRequest: {
          type: 'object', required: ['productId', 'quantity'],
          properties: {
            productId: { type: 'string', example: '64b1f2c3d4e5f6a7b8c9d0e1' },
            quantity:  { type: 'integer', minimum: 0, example: 3, description: 'Set to 0 to remove the item' },
          },
        },
        RemoveFromCartRequest: {
          type: 'object', required: ['productId'],
          properties: {
            productId: { type: 'string', example: '64b1f2c3d4e5f6a7b8c9d0e1' },
            quantity:  { type: 'integer', example: 1, description: 'Pass -1 to remove entirely regardless of quantity' },
          },
        },
        // ── Order ─────────────────────────────────────────────────────────────
        ShippingAddress: {
          type: 'object', required: ['fullName', 'line1', 'city', 'state', 'postalCode', 'country'],
          properties: {
            fullName:   { type: 'string', example: 'Jane Doe' },
            line1:      { type: 'string', example: '123 Main St' },
            line2:      { type: 'string', example: 'Apt 4B' },
            city:       { type: 'string', example: 'Cairo' },
            state:      { type: 'string', example: 'Cairo Governorate' },
            postalCode: { type: 'string', example: '11511' },
            country:    { type: 'string', example: 'Egypt' },
          },
        },
        OrderItemSnapshot: {
          type: 'object',
          properties: {
            productId: { type: 'string' },
            name:      { type: 'string', example: 'Classic Leather Jacket' },
            image:     { type: 'string', format: 'uri' },
            price:     { type: 'number', example: 49.99, description: 'Price locked at time of order' },
            quantity:  { type: 'integer', example: 2 },
            subtotal:  { type: 'number', example: 99.98 },
          },
        },
        OrderResponse: {
          type: 'object',
          properties: {
            id:              { type: 'string', example: '64b1f2c3d4e5f6a7b8c9d0e1' },
            userId:          { type: 'string', example: '64b1f2c3d4e5f6a7b8c9d0e2' },
            items:           { type: 'array', items: { '$ref': '#/components/schemas/OrderItemSnapshot' } },
            shippingAddress: { '$ref': '#/components/schemas/ShippingAddress' },
            status:          { type: 'string', enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'] },
            total:           { type: 'number', example: 149.97 },
            paymentIntentId: { type: 'string', nullable: true, example: 'pi_3N...' },
            createdAt:       { type: 'string', format: 'date-time' },
            updatedAt:       { type: 'string', format: 'date-time' },
          },
        },
        PlaceOrderRequest: {
          type: 'object', required: ['shippingAddress'],
          properties: { shippingAddress: { '$ref': '#/components/schemas/ShippingAddress' } },
        },
        UpdateOrderStatusRequest: {
          type: 'object', required: ['status'],
          properties: { status: { type: 'string', enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'] } },
        },
        // ── Payment ───────────────────────────────────────────────────────────
        CreatePaymentIntentRequest: {
          type: 'object', required: ['orderId'],
          properties: { orderId: { type: 'string', example: '64b1f2c3d4e5f6a7b8c9d0e1' } },
        },
        PaymentIntentResponse: {
          type: 'object',
          properties: {
            clientSecret:    { type: 'string', example: 'pi_3N..._secret_...' },
            paymentIntentId: { type: 'string', example: 'pi_3N...' },
            amount:          { type: 'integer', example: 14997, description: 'Amount in cents' },
            currency:        { type: 'string', example: 'usd' },
          },
        },
        RefundRequest: {
          type: 'object', required: ['orderId'],
          properties: {
            orderId: { type: 'string', example: '64b1f2c3d4e5f6a7b8c9d0e1' },
            reason:  { type: 'string', maxLength: 500, example: 'Item arrived damaged' },
          },
        },
        // ── Review ────────────────────────────────────────────────────────────
        ReviewResponse: {
          type: 'object',
          properties: {
            id:        { type: 'string', example: '64b1f2c3d4e5f6a7b8c9d0e1' },
            userId:    { type: 'string', example: '64b1f2c3d4e5f6a7b8c9d0e2' },
            username:  { type: 'string', example: 'johndoe' },
            productId: { type: 'string', example: '64b1f2c3d4e5f6a7b8c9d0e3' },
            rating:    { type: 'integer', minimum: 1, maximum: 5, example: 5 },
            comment:   { type: 'string', example: 'Absolutely love this jacket!' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        CreateReviewRequest: {
          type: 'object', required: ['productId', 'rating', 'comment'],
          properties: {
            productId: { type: 'string', example: '64b1f2c3d4e5f6a7b8c9d0e3' },
            rating:    { type: 'integer', minimum: 1, maximum: 5, example: 5 },
            comment:   { type: 'string', maxLength: 1000, example: 'Absolutely love this jacket!' },
          },
        },
      },
      // ── Reusable responses ────────────────────────────────────────────────────
      responses: {
        Unauthorized:         { description: 'Authentication token missing or invalid',      content: { 'application/json': { schema: { '$ref': '#/components/schemas/ErrorResponse' } } } },
        Forbidden:            { description: 'Insufficient permissions for this action',     content: { 'application/json': { schema: { '$ref': '#/components/schemas/ErrorResponse' } } } },
        NotFound:             { description: 'Resource not found',                           content: { 'application/json': { schema: { '$ref': '#/components/schemas/ErrorResponse' } } } },
        UnprocessableEntity:  { description: 'Validation error — check message for details', content: { 'application/json': { schema: { '$ref': '#/components/schemas/ErrorResponse' } } } },
        TooManyRequests:      { description: 'Rate limit exceeded',                          content: { 'application/json': { schema: { '$ref': '#/components/schemas/ErrorResponse' } } } },
      },
      // ── Reusable parameters ───────────────────────────────────────────────────
      parameters: {
        IdParam:        { name: 'id',        in: 'path',  required: true,  schema: { type: 'string', example: '64b1f2c3d4e5f6a7b8c9d0e1' }, description: 'MongoDB ObjectId' },
        PageQuery:      { name: 'page',      in: 'query', required: false, schema: { type: 'integer', minimum: 1, default: 1 } },
        LimitQuery:     { name: 'limit',     in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
        SortOrderQuery: { name: 'sortOrder', in: 'query', required: false, schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' } },
      },
    },
    tags: [
      { name: 'Auth',     description: 'Authentication — signup, login, token refresh' },
      { name: 'Users',    description: 'User profile management and admin user controls' },
      { name: 'Products', description: 'Product catalogue — listings, search, CRUD (admin)' },
      { name: 'Cart',     description: 'Shopping cart — add, update, remove, clear items' },
      { name: 'Orders',   description: 'Order placement, history, and status management' },
      { name: 'Payments', description: 'Stripe payment intents, refunds, and webhook handler' },
      { name: 'Reviews',  description: 'Product reviews — submit, list, rate, delete' },
    ],
    paths: {
      // ── Auth ────────────────────────────────────────────────────────────────────
      '/api/auth/signup': {
        post: {
          tags: ['Auth'], summary: 'Register a new user account',
          requestBody: { required: true, content: { 'application/json': { schema: { '$ref': '#/components/schemas/SignupRequest' } } } },
          responses: {
            201: { description: 'Account created — returns JWT and user profile', content: { 'application/json': { schema: { allOf: [{ '$ref': '#/components/schemas/ApiResponse' }, { properties: { data: { '$ref': '#/components/schemas/AuthResponse' } } }] } } } },
            409: { description: 'Email already in use' },
            422: { '$ref': '#/components/responses/UnprocessableEntity' },
          },
        },
      },
      '/api/auth/login': {
        post: {
          tags: ['Auth'], summary: 'Log in with email and password',
          requestBody: { required: true, content: { 'application/json': { schema: { '$ref': '#/components/schemas/LoginRequest' } } } },
          responses: {
            200: { description: 'Logged in — returns JWT and user profile', content: { 'application/json': { schema: { allOf: [{ '$ref': '#/components/schemas/ApiResponse' }, { properties: { data: { '$ref': '#/components/schemas/AuthResponse' } } }] } } } },
            401: { description: 'Invalid email or password' },
            422: { '$ref': '#/components/responses/UnprocessableEntity' },
          },
        },
      },
      '/api/auth/refresh': {
        post: {
          tags: ['Auth'], summary: 'Issue a new JWT using an existing token',
          security: [{ BearerAuth: [] }],
          responses: {
            200: { description: 'New token issued' },
            401: { '$ref': '#/components/responses/Unauthorized' },
          },
        },
      },
      '/api/auth/me': {
        get: {
          tags: ['Auth'], summary: "Get the authenticated user's token payload",
          security: [{ BearerAuth: [] }],
          responses: {
            200: { description: 'Token payload returned' },
            401: { '$ref': '#/components/responses/Unauthorized' },
          },
        },
      },
      // ── Users ───────────────────────────────────────────────────────────────────
      '/api/users/me': {
        get: {
          tags: ['Users'], summary: 'Get own user profile',
          security: [{ BearerAuth: [] }],
          responses: {
            200: { description: 'User profile', content: { 'application/json': { schema: { allOf: [{ '$ref': '#/components/schemas/ApiResponse' }, { properties: { data: { '$ref': '#/components/schemas/UserResponse' } } }] } } } },
            401: { '$ref': '#/components/responses/Unauthorized' },
          },
        },
        patch: {
          tags: ['Users'], summary: 'Update own username or email',
          security: [{ BearerAuth: [] }],
          requestBody: { required: true, content: { 'application/json': { schema: { '$ref': '#/components/schemas/UpdateProfileRequest' } } } },
          responses: {
            200: { description: 'Profile updated' },
            401: { '$ref': '#/components/responses/Unauthorized' },
            409: { description: 'Email already in use by another account' },
            422: { '$ref': '#/components/responses/UnprocessableEntity' },
          },
        },
        delete: {
          tags: ['Users'], summary: 'Deactivate own account (soft-delete)',
          security: [{ BearerAuth: [] }],
          responses: {
            200: { description: 'Account deactivated' },
            401: { '$ref': '#/components/responses/Unauthorized' },
          },
        },
      },
      '/api/users/me/password': {
        patch: {
          tags: ['Users'], summary: 'Change own password',
          security: [{ BearerAuth: [] }],
          requestBody: { required: true, content: { 'application/json': { schema: { '$ref': '#/components/schemas/ChangePasswordRequest' } } } },
          responses: {
            200: { description: 'Password changed' },
            401: { description: 'Unauthorized or wrong current password' },
            422: { '$ref': '#/components/responses/UnprocessableEntity' },
          },
        },
      },
      '/api/users': {
        get: {
          tags: ['Users'], summary: 'List all users — Admin only',
          security: [{ BearerAuth: [] }],
          parameters: [
            { '$ref': '#/components/parameters/PageQuery' },
            { '$ref': '#/components/parameters/LimitQuery' },
            { name: 'role',     in: 'query', schema: { type: 'string', enum: ['user', 'admin'] } },
            { name: 'isActive', in: 'query', schema: { type: 'boolean' } },
            { name: 'search',   in: 'query', schema: { type: 'string' }, description: 'Search by username or email' },
          ],
          responses: {
            200: { description: 'Paginated user list' },
            401: { '$ref': '#/components/responses/Unauthorized' },
            403: { '$ref': '#/components/responses/Forbidden' },
          },
        },
      },
      '/api/users/{id}': {
        get: {
          tags: ['Users'], summary: 'Get a user by ID — Admin only',
          security: [{ BearerAuth: [] }],
          parameters: [{ '$ref': '#/components/parameters/IdParam' }],
          responses: {
            200: { description: 'User profile' },
            401: { '$ref': '#/components/responses/Unauthorized' },
            403: { '$ref': '#/components/responses/Forbidden' },
            404: { '$ref': '#/components/responses/NotFound' },
          },
        },
        patch: {
          tags: ['Users'], summary: 'Update any user — Admin only',
          security: [{ BearerAuth: [] }],
          parameters: [{ '$ref': '#/components/parameters/IdParam' }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { type: 'object', properties: { username: { type: 'string' }, email: { type: 'string' }, role: { type: 'string', enum: ['user', 'admin'] }, isActive: { type: 'boolean' } } } } },
          },
          responses: {
            200: { description: 'User updated' },
            401: { '$ref': '#/components/responses/Unauthorized' },
            403: { '$ref': '#/components/responses/Forbidden' },
            404: { '$ref': '#/components/responses/NotFound' },
          },
        },
        delete: {
          tags: ['Users'], summary: 'Deactivate a user — Admin only',
          security: [{ BearerAuth: [] }],
          parameters: [{ '$ref': '#/components/parameters/IdParam' }],
          responses: {
            200: { description: 'User deactivated' },
            401: { '$ref': '#/components/responses/Unauthorized' },
            403: { '$ref': '#/components/responses/Forbidden' },
            404: { '$ref': '#/components/responses/NotFound' },
          },
        },
      },
      // ── Products ────────────────────────────────────────────────────────────────
      '/api/products': {
        get: {
          tags: ['Products'], summary: 'List products with filters and pagination',
          parameters: [
            { '$ref': '#/components/parameters/PageQuery' },
            { '$ref': '#/components/parameters/LimitQuery' },
            { '$ref': '#/components/parameters/SortOrderQuery' },
            { name: 'category',  in: 'query', schema: { type: 'string', enum: ['men', 'women', 'kids'] } },
            { name: 'minPrice',  in: 'query', schema: { type: 'number', minimum: 0 } },
            { name: 'maxPrice',  in: 'query', schema: { type: 'number', minimum: 0 } },
            { name: 'search',    in: 'query', schema: { type: 'string' }, description: 'Full-text search on product name' },
            { name: 'available', in: 'query', schema: { type: 'boolean' } },
          ],
          responses: {
            200: { description: 'Paginated product list', content: { 'application/json': { schema: { '$ref': '#/components/schemas/PaginatedResult' } } } },
            422: { '$ref': '#/components/responses/UnprocessableEntity' },
          },
        },
        post: {
          tags: ['Products'], summary: 'Create a product — Admin only',
          security: [{ BearerAuth: [] }],
          requestBody: { required: true, content: { 'application/json': { schema: { '$ref': '#/components/schemas/CreateProductRequest' } } } },
          responses: {
            201: { description: 'Product created', content: { 'application/json': { schema: { allOf: [{ '$ref': '#/components/schemas/ApiResponse' }, { properties: { data: { '$ref': '#/components/schemas/ProductResponse' } } }] } } } },
            401: { '$ref': '#/components/responses/Unauthorized' },
            403: { '$ref': '#/components/responses/Forbidden' },
            422: { '$ref': '#/components/responses/UnprocessableEntity' },
          },
        },
      },
      '/api/products/new-collection': {
        get: {
          tags: ['Products'], summary: 'Get the 8 most recently added available products',
          responses: { 200: { description: 'Array of up to 8 products' } },
        },
      },
      '/api/products/popular/{category}': {
        get: {
          tags: ['Products'], summary: 'Get the 4 most recent available products in a category',
          parameters: [{ name: 'category', in: 'path', required: true, schema: { type: 'string', enum: ['men', 'women', 'kids'] } }],
          responses: {
            200: { description: 'Array of up to 4 products' },
            400: { description: 'Invalid category' },
          },
        },
      },
      '/api/products/upload': {
        post: {
          tags: ['Products'], summary: 'Upload a product image — Admin only',
          security: [{ BearerAuth: [] }],
          requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', properties: { product: { type: 'string', format: 'binary' } } } } } },
          responses: {
            200: { description: 'Upload successful — returns image URL' },
            400: { description: 'No image file provided' },
            401: { '$ref': '#/components/responses/Unauthorized' },
            403: { '$ref': '#/components/responses/Forbidden' },
          },
        },
      },
      '/api/products/{id}': {
        get: {
          tags: ['Products'], summary: 'Get a single product by ID',
          parameters: [{ '$ref': '#/components/parameters/IdParam' }],
          responses: {
            200: { description: 'Product', content: { 'application/json': { schema: { allOf: [{ '$ref': '#/components/schemas/ApiResponse' }, { properties: { data: { '$ref': '#/components/schemas/ProductResponse' } } }] } } } },
            404: { '$ref': '#/components/responses/NotFound' },
            422: { '$ref': '#/components/responses/UnprocessableEntity' },
          },
        },
        patch: {
          tags: ['Products'], summary: 'Partially update a product — Admin only',
          security: [{ BearerAuth: [] }],
          parameters: [{ '$ref': '#/components/parameters/IdParam' }],
          requestBody: { required: true, content: { 'application/json': { schema: { '$ref': '#/components/schemas/UpdateProductRequest' } } } },
          responses: {
            200: { description: 'Product updated' },
            401: { '$ref': '#/components/responses/Unauthorized' },
            403: { '$ref': '#/components/responses/Forbidden' },
            404: { '$ref': '#/components/responses/NotFound' },
          },
        },
        delete: {
          tags: ['Products'], summary: 'Delete a product — Admin only',
          security: [{ BearerAuth: [] }],
          parameters: [{ '$ref': '#/components/parameters/IdParam' }],
          responses: {
            200: { description: 'Product deleted' },
            401: { '$ref': '#/components/responses/Unauthorized' },
            403: { '$ref': '#/components/responses/Forbidden' },
            404: { '$ref': '#/components/responses/NotFound' },
          },
        },
      },
      // ── Cart ────────────────────────────────────────────────────────────────────
      '/api/cart': {
        get: {
          tags: ['Cart'], summary: 'Get own cart with populated items and totals',
          security: [{ BearerAuth: [] }],
          responses: {
            200: { description: 'Cart', content: { 'application/json': { schema: { allOf: [{ '$ref': '#/components/schemas/ApiResponse' }, { properties: { data: { '$ref': '#/components/schemas/CartResponse' } } }] } } } },
            401: { '$ref': '#/components/responses/Unauthorized' },
          },
        },
        delete: {
          tags: ['Cart'], summary: 'Clear all items from the cart',
          security: [{ BearerAuth: [] }],
          responses: {
            200: { description: 'Cart cleared' },
            401: { '$ref': '#/components/responses/Unauthorized' },
          },
        },
      },
      '/api/cart/items': {
        post: {
          tags: ['Cart'], summary: 'Add a product to the cart (increments if already present)',
          security: [{ BearerAuth: [] }],
          requestBody: { required: true, content: { 'application/json': { schema: { '$ref': '#/components/schemas/AddToCartRequest' } } } },
          responses: {
            200: { description: 'Item added — updated cart returned' },
            401: { '$ref': '#/components/responses/Unauthorized' },
            404: { description: 'Product not found or unavailable' },
            422: { '$ref': '#/components/responses/UnprocessableEntity' },
          },
        },
        patch: {
          tags: ['Cart'], summary: 'Set a cart item to an absolute quantity (0 removes it)',
          security: [{ BearerAuth: [] }],
          requestBody: { required: true, content: { 'application/json': { schema: { '$ref': '#/components/schemas/UpdateCartItemRequest' } } } },
          responses: {
            200: { description: 'Cart item updated' },
            401: { '$ref': '#/components/responses/Unauthorized' },
            422: { '$ref': '#/components/responses/UnprocessableEntity' },
          },
        },
        delete: {
          tags: ['Cart'], summary: 'Decrement or fully remove a cart item',
          security: [{ BearerAuth: [] }],
          requestBody: { required: true, content: { 'application/json': { schema: { '$ref': '#/components/schemas/RemoveFromCartRequest' } } } },
          responses: {
            200: { description: 'Item removed or decremented — updated cart returned' },
            400: { description: 'Product not in cart' },
            401: { '$ref': '#/components/responses/Unauthorized' },
            422: { '$ref': '#/components/responses/UnprocessableEntity' },
          },
        },
      },
      // ── Orders ──────────────────────────────────────────────────────────────────
      '/api/orders': {
        get: {
          tags: ['Orders'], summary: 'List all orders — Admin only',
          security: [{ BearerAuth: [] }],
          parameters: [
            { '$ref': '#/components/parameters/PageQuery' },
            { '$ref': '#/components/parameters/LimitQuery' },
            { name: 'status', in: 'query', schema: { type: 'string', enum: ['pending','confirmed','processing','shipped','delivered','cancelled','refunded'] } },
            { name: 'userId', in: 'query', schema: { type: 'string' }, description: 'Filter by user ID' },
          ],
          responses: {
            200: { description: 'Paginated order list' },
            401: { '$ref': '#/components/responses/Unauthorized' },
            403: { '$ref': '#/components/responses/Forbidden' },
          },
        },
        post: {
          tags: ['Orders'], summary: 'Place an order from the current cart',
          security: [{ BearerAuth: [] }],
          requestBody: { required: true, content: { 'application/json': { schema: { '$ref': '#/components/schemas/PlaceOrderRequest' } } } },
          responses: {
            201: { description: 'Order placed — cart is cleared', content: { 'application/json': { schema: { allOf: [{ '$ref': '#/components/schemas/ApiResponse' }, { properties: { data: { '$ref': '#/components/schemas/OrderResponse' } } }] } } } },
            400: { description: 'Cart is empty' },
            401: { '$ref': '#/components/responses/Unauthorized' },
            409: { description: 'One or more cart items are no longer available' },
            422: { '$ref': '#/components/responses/UnprocessableEntity' },
          },
        },
      },
      '/api/orders/my': {
        get: {
          tags: ['Orders'], summary: 'Get own order history',
          security: [{ BearerAuth: [] }],
          parameters: [
            { '$ref': '#/components/parameters/PageQuery' },
            { '$ref': '#/components/parameters/LimitQuery' },
            { name: 'status', in: 'query', schema: { type: 'string', enum: ['pending','confirmed','processing','shipped','delivered','cancelled','refunded'] } },
          ],
          responses: {
            200: { description: 'Paginated order history' },
            401: { '$ref': '#/components/responses/Unauthorized' },
          },
        },
      },
      '/api/orders/{id}': {
        get: {
          tags: ['Orders'], summary: 'Get a single order (own or any for Admin)',
          security: [{ BearerAuth: [] }],
          parameters: [{ '$ref': '#/components/parameters/IdParam' }],
          responses: {
            200: { description: 'Order returned' },
            401: { '$ref': '#/components/responses/Unauthorized' },
            403: { '$ref': '#/components/responses/Forbidden' },
            404: { '$ref': '#/components/responses/NotFound' },
          },
        },
      },
      '/api/orders/{id}/status': {
        patch: {
          tags: ['Orders'], summary: 'Update order status — Admin only (state machine enforced)',
          security: [{ BearerAuth: [] }],
          parameters: [{ '$ref': '#/components/parameters/IdParam' }],
          requestBody: { required: true, content: { 'application/json': { schema: { '$ref': '#/components/schemas/UpdateOrderStatusRequest' } } } },
          responses: {
            200: { description: 'Order status updated' },
            401: { '$ref': '#/components/responses/Unauthorized' },
            403: { '$ref': '#/components/responses/Forbidden' },
            404: { '$ref': '#/components/responses/NotFound' },
            422: { description: 'Invalid state transition' },
          },
        },
      },
      '/api/orders/{id}/cancel': {
        delete: {
          tags: ['Orders'], summary: 'Cancel an order (own or any for Admin)',
          security: [{ BearerAuth: [] }],
          parameters: [{ '$ref': '#/components/parameters/IdParam' }],
          responses: {
            200: { description: 'Order cancelled' },
            401: { '$ref': '#/components/responses/Unauthorized' },
            403: { '$ref': '#/components/responses/Forbidden' },
            404: { '$ref': '#/components/responses/NotFound' },
            422: { description: 'Order cannot be cancelled at current status' },
          },
        },
      },
      // ── Payments ────────────────────────────────────────────────────────────────
      '/api/payments/create-intent': {
        post: {
          tags: ['Payments'], summary: 'Create a Stripe PaymentIntent for a pending order',
          description: "Returns a clientSecret for stripe.confirmPayment(). Only the order's owner can initiate payment.",
          security: [{ BearerAuth: [] }],
          requestBody: { required: true, content: { 'application/json': { schema: { '$ref': '#/components/schemas/CreatePaymentIntentRequest' } } } },
          responses: {
            201: { description: 'PaymentIntent created', content: { 'application/json': { schema: { allOf: [{ '$ref': '#/components/schemas/ApiResponse' }, { properties: { data: { '$ref': '#/components/schemas/PaymentIntentResponse' } } }] } } } },
            401: { '$ref': '#/components/responses/Unauthorized' },
            403: { '$ref': '#/components/responses/Forbidden' },
            404: { '$ref': '#/components/responses/NotFound' },
            422: { description: 'Order is not in PENDING status' },
          },
        },
      },
      '/api/payments/refund': {
        post: {
          tags: ['Payments'], summary: 'Issue a full refund for a delivered order',
          security: [{ BearerAuth: [] }],
          requestBody: { required: true, content: { 'application/json': { schema: { '$ref': '#/components/schemas/RefundRequest' } } } },
          responses: {
            200: { description: 'Refund issued successfully' },
            401: { '$ref': '#/components/responses/Unauthorized' },
            403: { '$ref': '#/components/responses/Forbidden' },
            422: { description: 'Order is not DELIVERED or has no payment on file' },
          },
        },
      },
      '/api/payments/webhook': {
        post: {
          tags: ['Payments'], summary: 'Stripe webhook receiver — do not call directly',
          description: 'Receives signed events from Stripe. Requires raw body and Stripe-Signature header for HMAC verification.',
          parameters: [{ name: 'stripe-signature', in: 'header', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'Event acknowledged' },
            400: { description: 'Invalid or missing signature' },
          },
        },
      },
      // ── Reviews ─────────────────────────────────────────────────────────────────
      '/api/reviews': {
        get: {
          tags: ['Reviews'], summary: 'List all reviews — Admin only',
          security: [{ BearerAuth: [] }],
          parameters: [
            { '$ref': '#/components/parameters/PageQuery' },
            { '$ref': '#/components/parameters/LimitQuery' },
            { name: 'rating',    in: 'query', schema: { type: 'integer', minimum: 1, maximum: 5 } },
            { name: 'productId', in: 'query', schema: { type: 'string' } },
            { name: 'userId',    in: 'query', schema: { type: 'string' } },
          ],
          responses: {
            200: { description: 'Paginated review list' },
            401: { '$ref': '#/components/responses/Unauthorized' },
            403: { '$ref': '#/components/responses/Forbidden' },
          },
        },
        post: {
          tags: ['Reviews'], summary: 'Submit a review for a purchased product',
          description: 'Requires a delivered order containing the product. One review per user per product.',
          security: [{ BearerAuth: [] }],
          requestBody: { required: true, content: { 'application/json': { schema: { '$ref': '#/components/schemas/CreateReviewRequest' } } } },
          responses: {
            201: { description: 'Review submitted' },
            401: { '$ref': '#/components/responses/Unauthorized' },
            403: { description: 'No delivered order found for this product' },
            404: { '$ref': '#/components/responses/NotFound' },
            409: { description: 'User has already reviewed this product' },
            422: { '$ref': '#/components/responses/UnprocessableEntity' },
          },
        },
      },
      '/api/reviews/product/{productId}': {
        get: {
          tags: ['Reviews'], summary: 'Get paginated reviews for a product',
          parameters: [
            { name: 'productId', in: 'path', required: true, schema: { type: 'string' } },
            { '$ref': '#/components/parameters/PageQuery' },
            { '$ref': '#/components/parameters/LimitQuery' },
            { '$ref': '#/components/parameters/SortOrderQuery' },
            { name: 'rating', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 5 } },
          ],
          responses: {
            200: { description: 'Paginated reviews' },
            404: { '$ref': '#/components/responses/NotFound' },
            422: { '$ref': '#/components/responses/UnprocessableEntity' },
          },
        },
      },
      '/api/reviews/product/{productId}/rating': {
        get: {
          tags: ['Reviews'], summary: 'Get average rating and total review count for a product',
          parameters: [{ name: 'productId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'Average rating and count', content: { 'application/json': { schema: { properties: { success: { type: 'boolean' }, data: { properties: { average: { type: 'number', example: 4.5 }, count: { type: 'integer', example: 12 } } } } } } } },
            422: { '$ref': '#/components/responses/UnprocessableEntity' },
          },
        },
      },
      '/api/reviews/{id}': {
        delete: {
          tags: ['Reviews'], summary: 'Delete a review (own review or any for Admin)',
          security: [{ BearerAuth: [] }],
          parameters: [{ '$ref': '#/components/parameters/IdParam' }],
          responses: {
            200: { description: 'Review deleted' },
            401: { '$ref': '#/components/responses/Unauthorized' },
            403: { '$ref': '#/components/responses/Forbidden' },
            404: { '$ref': '#/components/responses/NotFound' },
          },
        },
      },
    },
  },
  apis: [], // All paths defined inline above
};

export const swaggerSpec = swaggerJsdoc(options);