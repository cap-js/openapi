# Best Programming Practices for @cap-js/openapi

This guide outlines the best programming practices for the @cap-js/openapi project. These practices are designed to ensure code quality, maintainability, and consistency across the project.

## Table of Contents
1. [Clean Code](#clean-code)
2. [Single Responsibility Principle (SRP)](#single-responsibility-principle)
3. [Immutability](#immutability)
4. [Dependency Injection (DI)](#dependency-injection)
5. [Guidelines for New Code](#guidelines-for-new-code)

## Clean Code

Clean code is self-explanatory and easy to understand without extensive comments. Here are some key principles:

- Use meaningful and pronounceable variable names
- Use meaningful and pronounceable function names
- Avoid using flags as function parameters
- Functions should do one thing
- Use default arguments instead of short-circuiting or conditionals

Example:
```javascript
// Good
function createUser(name, email, isAdmin = false) {
  // ...
}

// Avoid
function createUser(name, email, admin) {
  const isAdmin = admin || false;
  // ...
}
```

## Single Responsibility Principle

Each module or class should have responsibility over a single part of the functionality provided by the software, and that responsibility should be entirely encapsulated by the class.

Example:
```javascript
// Good
class UserAuthentication {
  authenticate(user, password) {
    // ...
  }
}

class UserRepository {
  save(user) {
    // ...
  }
}

// Avoid
class User {
  authenticate(password) {
    // ...
  }
  
  save() {
    // ...
  }
}
```

## Immutability

Prefer immutable data structures and pure functions. This helps prevent unintended side effects and makes the code easier to reason about.

Example:
```javascript
// Good
const addItem = (list, item) => [...list, item];

// Avoid
const addItem = (list, item) => {
  list.push(item);
  return list;
};
```

## Dependency Injection

Use dependency injection to decouple the construction of objects from their usage. This makes the code more modular and easier to test.

Example:
```javascript
// Good
class UserService {
  constructor(userRepository) {
    this.userRepository = userRepository;
  }
  
  getUser(id) {
    return this.userRepository.findById(id);
  }
}

// Avoid
class UserService {
  constructor() {
    this.userRepository = new UserRepository();
  }
  
  getUser(id) {
    return this.userRepository.findById(id);
  }
}
```

## Guidelines for New Code

When adding new code to the project, follow these guidelines:

1. Ensure your code adheres to the principles outlined in this document
2. Write unit tests for new functionality
3. Update documentation if you're changing existing APIs or adding new features
4. Use ESLint to catch potential issues early
5. Perform a self-review before submitting your code for review

Remember, the goal is to write code that is easy to understand, maintain, and extend. When in doubt, prioritize readability and simplicity over cleverness.

## ESLint Configuration

Key configuration choices:

- `func-style`: Off. Use the most appropriate function style for each situation.
- `no-nested-ternary`: Removed. Use newlines for readability in nested ternaries.
- `no-param-reassign`: Warn. Consider alternatives to parameter reassignment.
- `object-shorthand`: Warn. Use concise object literal syntax when possible.
- `require-await`: Warn. Ensure async functions use `await`.

These rules guide code quality and consistency. Use good judgment in their application.
