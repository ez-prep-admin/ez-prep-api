# EZ Prep API - User Management Endpoints

## Base URL
```
http://localhost:3000/api/v1
```

## Health Check
- **GET** `/health` - Check API health status

## User Management Endpoints

### Create User
- **POST** `/users`
- **Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phoneNumber": "+1234567890",
  "role": "user" // optional, defaults to "user"
}
```

### Get All Users
- **GET** `/users`
- **Query Parameters:**
  - `role` (optional): Filter by role (`user` or `admin`)

### Get User by ID
- **GET** `/users/:id`

### Update User
- **PATCH** `/users/:id`
- **Body:** (all fields optional)
```json
{
  "name": "Updated Name",
  "email": "updated@example.com",
  "phoneNumber": "+1234567891",
  "role": "admin",
  "isActive": true
}
```

### Toggle User Status
- **PATCH** `/users/:id/toggle-status`

### Soft Delete User
- **DELETE** `/users/:id`

### Restore Deleted User
- **POST** `/users/:id/restore`

### Hard Delete User (Permanent)
- **DELETE** `/users/:id/hard`

### Admin Endpoints

#### Get All Users (Including Deleted)
- **GET** `/users/with-deleted`

#### Get User Statistics
- **GET** `/users/stats`
- **Response:**
```json
{
  "message": "User statistics retrieved successfully",
  "data": {
    "totalUsers": 10,
    "activeUsers": 8,
    "adminUsers": 2,
    "deletedUsers": 1,
    "inactiveUsers": 2
  }
}
```

## User Roles
- `user` - Regular user with basic permissions
- `admin` - Administrator with elevated permissions

## Response Format
All endpoints return responses in the following format:
```json
{
  "message": "Operation description",
  "data": {}, // Response data
  "count": 0 // For list endpoints
}
```

## User Schema
```json
{
  "id": "string",
  "name": "string",
  "email": "string",
  "phoneNumber": "string",
  "role": "user|admin",
  "isActive": "boolean",
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

## Sample Test Data
The application includes sample users:
- Admin: `admin@ezprep.com` (Admin role)
- Jane User: `jane.user@example.com` (User role)
- Bob Student: `bob.student@example.com` (User role)
- Alice Manager: `alice.manager@ezprep.com` (Admin role)
- Charlie Test: `charlie.test@example.com` (Inactive user)
