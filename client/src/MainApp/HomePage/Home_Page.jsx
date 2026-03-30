import { useState } from "react";
import "./HP_styles.css";
import globeLogo from "../../assets/Globe_LogoB.png";
import { useNavigate } from "react-router-dom";
import LoadingScreen from '../../components/LoadingScreen';

function HomePage() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleNavigate = (path) => {
    setIsLoading(true);
    setTimeout(() => {
      navigate(path);
    }, 1000); // simulate loading
  };

  return (
    <div className="homepage">
      {isLoading && <LoadingScreen logo={globeLogo} />}

      <div className="card">
        <div className="logoSection">
          <img src={globeLogo} className="logo" alt="Globe Logo"/>
        </div>

        <div className="textSection">
          <h2 className="title">REGIONAL SURVEILLANCE CENTER</h2>
        </div>

        <div className="dropdown">
          <button 
            className={`dropdownBtn ${open ? "active" : ""}`}
            onClick={() => setOpen(!open)}
          >
            Services ▾
          </button>

          <div className={`dropdownMenu ${open ? "show" : ""}`}>
            <button className="choice" onClick={() => handleNavigate("/Storm_Master_List")}>
              Storm Master List
            </button>
            <button className="choice" onClick={() => handleNavigate("/Site_Alert_Isolation")}>
              Site Alert Isolation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HomePage;