import { Link, useNavigate } from "react-router-dom";

export default function GoHomeLink() {
    const navigate = useNavigate();

    const goHomeClick = (e: React.MouseEvent) => {
        e.preventDefault();
        navigate("/");
    };

    return (<Link to="#" onClick={goHomeClick} className="text-blue-500 hover:underline">
        ← Go Home
    </Link>)
}