const {
  handleRegister,
  getUserbyID,
  updateUser,
  isUserAFriend,
  addNewFriend,
  removeFriend,
  getUserFriends,
  updateAvatar,
} = require("../controllers/userController");
const admin = require("firebase-admin");
const mockDb = {
  collection: jest.fn(() => ({
    doc: jest.fn(() => ({
      set: jest.fn().mockResolvedValueOnce(true), // Returns success for set
      update: jest.fn().mockResolvedValueOnce(true), // Returns success for update
      get: jest.fn(() => ({
        exists: true,
        data: jest.fn().mockReturnValueOnce({
          id: "123",
          name: "Test User",
          email: "test@test.com",
          birthDate: "2000-01-01",
          address: "Test Address",
        }),
      })),
    })),
    get: jest.fn(() => ({
      empty: false,
      forEach: jest.fn().mockImplementationOnce((cb) =>
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
    })),
    where: jest.fn(() => ({
      get: jest.fn().mockResolvedValueOnce({
        empty: false,
        docs: [{ data: () => ({ id: "123", name: "Test User" }) }],
      }),
    })),
  })),
};

describe("User Controller Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should handle user registration", async () => {
    const req = {
      body: {
        email: "test@test.com",
        name: "Test User",
        id: "123",
        birthDate: "2000-01-01",
        address: "Test Address",
      },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await handleRegister(req, res, mockDb);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test("should get user by ID", async () => {
    const req = { params: { id: "123" } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockDb
      .collection()
      .where()
      .get.mockResolvedValueOnce({
        empty: false,
        docs: [{ data: () => ({ id: "123", name: "Test User" }) }],
      });

    await getUserbyID(req, res, mockDb);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("should update user details", async () => {
    const req = {
      params: { id: "123" },
      body: { name: "Updated User", birthDate: "2001-01-01", address: "Updated Address" },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await updateUser(req, res, mockDb);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: "Success" });
  });
});
