import React, { useState } from "react";

const Contact = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });

  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevState) => ({
      ...prevState,
      [name]: value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Here you would typically send the form data to your server
    console.log(formData);
    // For demo purposes, we'll just show a success message
    setSubmitted(true);
    // Reset form
    setFormData({
      name: "",
      email: "",
      subject: "",
      message: "",
    });
  };

  return (
    <div className="container mt-5">
      <h1>Contact Us</h1>

      <div className="card my-4 p-4">
        {submitted ? (
          <div className="alert alert-success">
            Thank you for your message! We will get back to you soon.
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group mb-3">
              <label htmlFor="name">Name</label>
              <input
                type="text"
                className="form-control"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group mb-3">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                className="form-control"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group mb-3">
              <label htmlFor="subject">Subject</label>
              <input
                type="text"
                className="form-control"
                id="subject"
                name="subject"
                value={formData.subject}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group mb-3">
              <label htmlFor="message">Message</label>
              <textarea
                className="form-control"
                id="message"
                name="message"
                value={formData.message}
                onChange={handleChange}
                rows="5"
                required
              ></textarea>
            </div>

            <button type="submit" className="btn btn-primary">
              Submit
            </button>
          </form>
        )}
      </div>

      <div className="card my-4 p-4">
        <h2>Our Information</h2>
        <p>
          <strong>Email:</strong> support@gazhan.com
        </p>
        <p>
          <strong>Phone:</strong> +972 12 345 6789
        </p>
        <p>
          <strong>Address:</strong> Tel Aviv, Israel
        </p>
      </div>
    </div>
  );
};

export default Contact;
