
import { Link, useNavigate } from "react-router-dom";



export default function GoBackLink() {
    const navigate = useNavigate();

    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        if (window.history.length > 1) {
            navigate(-1);
        } else {
            navigate("/");
        }
    };
    return (<Link to="#" onClick={handleClick} className="text-blue-500 hover:underline">
        ← Go Back
    </Link>)
}