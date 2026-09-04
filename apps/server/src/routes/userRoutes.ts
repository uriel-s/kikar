import express from "express";
import type { Router } from "express";
import { validate } from "../middleware/validate";
import { requireSelf } from "../middleware/auth";
import { schemas } from "@kikar/shared";
import type { createUserController } from "../controllers/userController";

export interface UserRoutesDeps {
  controller: ReturnType<typeof createUserController>;
}

export const createUserRoutes = ({ controller }: UserRoutesDeps): Router => {
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

  // Requests a presigned POST policy for the caller's own avatar object; the
  // browser POSTs directly to R2 from here, never through this server.
  router.post(
    "/:id/avatar/upload-url",
    validate(schemas.userId),
    requireSelf("id"),
    controller.requestAvatarUploadUrl
  );

  // Confirms a direct upload: reads the object back, validates it by its
  // magic bytes, and only then records the avatar URL.
  router.put(
    "/:id/avatar",
    validate(schemas.userId),
    requireSelf("id"),
    controller.updateAvatar
  );

  return router;
};
