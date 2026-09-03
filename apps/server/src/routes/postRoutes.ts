import express from "express";
import type { Router } from "express";
import { validate } from "../middleware/validate";
import { schemas } from "@kikar/shared";
import type { createPostController } from "../controllers/postController";

export interface PostRoutesDeps {
  controller: ReturnType<typeof createPostController>;
}

export const createPostRoutes = ({ controller }: PostRoutesDeps): Router => {
  const router = express.Router();

  router.post("/", validate(schemas.createPost), controller.create);
  router.get("/", validate(schemas.listPosts), controller.list);

  // Before "/:postId" so it is not parsed as a post id.
  router.get("/search", validate(schemas.search), controller.search);

  router.delete("/:postId", validate(schemas.postId), controller.remove);

  // A like belongs to the caller, so it is a sub-resource of the post rather
  // than a POST /posts/like carrying { postId, userId } in the body.
  router.put("/:postId/like", validate(schemas.postId), controller.like);
  router.delete("/:postId/like", validate(schemas.postId), controller.unlike);

  router.get(
    "/:postId/comments",
    validate(schemas.listComments),
    controller.listComments
  );
  router.post(
    "/:postId/comments",
    validate(schemas.createComment),
    controller.addComment
  );

  return router;
};
