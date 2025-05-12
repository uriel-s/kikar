const request = require("supertest");
const express = require("express");
const userRoute = require("../routes/userRoute");

// Mocked database
const mockDb = {
  collection: jest.fn(() => ({
    doc: jest.fn(() => ({
      set: jest.fn().mockResolvedValue(Promise.resolve()),
      update: jest.fn().mockResolvedValue(Promise.resolve()),
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: jest.fn(() => ({
          id: "123",
          name: "Test User",
          email: "test@test.com",
          birthDate: "2000-01-01",
          address: "Test Address",
        })),
      }),
    })),
    get: jest.fn().mockResolvedValue({
      empty: false,
      forEach: jest.fn((cb) =>
        cb({
          data: () => ({
            id: "123",
            name: "Test User",
            email: "test@test.com",
            birthDate: "2000-01-01",
            address: "Test Address",
          }),
        })
      ),
    }),
    where: jest.fn(() => ({
      get: jest.fn().mockResolvedValue({
        empty: false,
        docs: [{ data: () => ({ id: "123", name: "Test User" }) }],
      }),
    })),
  })),
};

// Test suite for user routes
describe("User Routes Tests", () => {
  let app;

  // Initialize app before each test
  beforeEach(() => {
    app = express();
    app.use(express.json()); // Ensure the body parser is in place
    userRoute(app, mockDb); // Register the routes
  });

  // Test user registration
  test("should register a user", async () => {
    const response = await request(app).post("/users").send({
      email: "test@test.com",
      name: "Test User",
      id: "123",
      birthDate: "2000-01-01",
      address: "Test Address",
    });

    expect(response.status).toBe(201); // Expect 201 Created status
  });

  // Test getting user by ID
  test("should get user by ID", async () => {
    mockDb
      .collection()
      .where()
      .get.mockResolvedValueOnce({
        empty: false,
        docs: [{ data: () => ({ id: "123", name: "Test User" }) }],
      });

    const response = await request(app).get("/users/123");
    expect(response.status).toBe(200); // Expect 200 OK status
  });

  // Test updating user details
  test("should update user details successfully", async () => {
    const updatedUserDetails = {
      name: "Updated Name",
      birthDate: "",
      address: "Updated Address",
    };

    const response = await request(app)
      .put("/users/123")
      .set("Content-Type", "application/json")
      .send(updatedUserDetails);

    // You can check the response if needed, e.g., ensure updated details are returned
    expect(response.status).toBe(200); // Expect 200 OK status
  }, 200);
});
