const express = require("express");
const { validate } = require("../middleware/validate");
const { requireSelf } = require("../middleware/auth");
const { schemas } = require("../schemas");

const createUserRoutes = ({ controller, uploadAvatar }) => {
  const router = express.Router();

  router.post("/", validate(schemas.registerUser), controller.register);
  router.get("/", validate(schemas.listUsers), controller.list);

  // Registered before "/:id" so "search" is not swallowed as a user id.
  router.get("/search", validate(schemas.search), controller.search);

  router.get("/:id", validate(schemas.userId), controller.getById);
  router.patch(
    "/:id",
    validate(schemas.updateUser),
    requireSelf("id"),
    controller.update
  );

  router.get("/:id/friends", validate(schemas.userId), controller.listFriends);
  router.get(
    "/:id/friends/:friendId",
    validate(schemas.friendPair),
    controller.isFriend
  );

  // Friending acts on the caller, so the :id in the path must be the caller.
  router.post(
    "/:id/friends",
    validate(schemas.addFriend),
    requireSelf("id"),
    controller.addFriend
  );
  router.delete(
    "/:id/friends/:friendId",
    validate(schemas.friendPair),
    requireSelf("id"),
    controller.removeFriend
  );

  router.put(
    "/:id/avatar",
    validate(schemas.userId),
    requireSelf("id"),
    uploadAvatar.single("avatar"),
    controller.updateAvatar
  );

  return router;
};

module.exports = { createUserRoutes };
