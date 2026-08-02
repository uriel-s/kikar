class Post {
  constructor(author, content) {
    this.author = author;
    this.content = content;
    this.createdAt = new Date();
    this.likes = []; // List of userIds who liked the post
    this.comments = []; // Each comment will include userId, content, and timestamp
  }

  toJSON() {
    return {
      author: this.author,
      content: this.content,
      createdAt: this.createdAt,
      likes: this.likes, // Only return the number of likes
      comments: this.comments,
    };
  }
}

module.exports = Post;
