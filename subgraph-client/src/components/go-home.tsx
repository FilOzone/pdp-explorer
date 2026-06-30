import { Link } from "react-router-dom";

export default function GoHomeLink() {
  return (
    <Link to="/" className="text-blue-500 hover:underline">
      ← Go Home
    </Link>
  );
}
