import express from "express";
import type { Router } from "express";
import type { Multer } from "multer";
import { validate } from "../middleware/validate";
import { requireSelf } from "../middleware/auth";
import { schemas } from "@kikar/shared";
import type { createUserController } from "../controllers/userController";

export interface UserRoutesDeps {
  controller: ReturnType<typeof createUserController>;
  // The configured multer instance, built in app.ts. It carries the 5 MB cap
  // and the mimetype pre-filter, so a router that constructed its own would
  // silently drop both.
  uploadAvatar: Multer;
}

export const createUserRoutes = ({
  controller,
  uploadAvatar,
}: UserRoutesDeps): Router => {
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
  router.get("/:id/friends/:friendId", validate(schemas.friendPair), controller.isFriend);

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
