import { useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

/*
  LandingPage (UTF-8 safe)
  - Signup: invite code check (local users -> Firestore invite_codes)
  - Login: local users first, then Firestore users
  - admin/game: bypass DB and delegate to onLogin (App.jsx에서 처리)
  - Enter key triggers login/signup
  - English-only strings to avoid encoding corruption during build/deploy
*/

const sanitizeText = (s) =>
  String(s ?? "")
    .replace(/\u200B/g, "") // zero-width space
    .replace(/\uFEFF/g, "") // BOM
    .trim();

const normalizeId = (s) => sanitizeText(s).toLowerCase();
const normalizePw = (s) => sanitizeText(s);

const passOf = (u) => String(u?.password ?? u?.pw ?? "");

const buildUserPasswordFields = (pw) => {
  const clean = normalizePw(pw);
  return { pw: clean, password: clean };
};

export default function LandingPage({
  t,
  lang,
  users,
  setUsers,
  onLogin,
  onGuestLogin,
  hero,
  videoURL,
  logo,
  logoSize,
  logoPos,
  styles,
  isAdmin,
  syncToFirebase,
}) {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [ref, setRef] = useState("");

  const texts = useMemo(
    () => ({
      fillAll: "Please fill all info.",
      idExists: "ID already exists.",
      invalidInvite: "Invalid invitation code.",
      needIdPw: "Enter ID & Password.",
      wrongPw: "Wrong Password.",
      idNotFound: "ID not found.",
      signupOk: "Signup Success! Please Login.",
      enterInvite: "Enter Invitation Code",
      newHere: "New here? Sign Up",
      haveAccount: "Have an account? Login",
    }),
    []
  );

  const signup = async () => {
    const cleanIdRaw = sanitizeText(id);
    const cleanPw = normalizePw(pw);
    const cleanRef = sanitizeText(ref);

    if (!cleanIdRaw || !cleanPw || !cleanRef) return alert(texts.fillAll);

    const cleanId = normalizeId(cleanIdRaw);

    // local duplicate check
    if (users.find((u) => normalizeId(u?.id) === cleanId)) {
      return alert(texts.idExists);
    }

    // Invite validation (keeps your behavior)
    let agentName = "";
    let isValidRef = false;

    if (cleanRef === "ADMIN") {
      isValidRef = true;
      agentName = "ADMIN";
    } else {
      const localInviteOwner = users.find((u) => u?.id === cleanRef);
      if (localInviteOwner) {
        isValidRef = true;
        agentName = localInviteOwner.id;
      } else {
        try {
          const inviteRef = doc(db, "invite_codes", cleanRef);
          const inviteSnap = await getDoc(inviteRef);

          if (inviteSnap.exists()) {
            isValidRef = true;
            agentName = inviteSnap.data()?.name ?? "";
          } else {
            return alert(texts.invalidInvite);
          }
        } catch (e) {
          console.error("Invite check error:", e);
          return alert(`Error: ${e.message}`);
        }
      }
    }

    if (!isValidRef) return;

    const startNo = 2783982189;
    const generatedNo = (startNo + users.length).toString();

    const newUser = {
      id: cleanId,
      ...buildUserPasswordFields(cleanPw),
      no: generatedNo,
      referral: cleanRef,
      diamond: 0,
      refCode: cleanId,
      agentName,
      joinedAt: new Date().toISOString(),
    };

    const updatedUsers = [...users, newUser];
    setUsers(updatedUsers);

    if (syncToFirebase) {
      await syncToFirebase({ users: updatedUsers });
    }

    alert(texts.signupOk);
    setId("");
    setPw("");
    setRef("");
    setMode("login");
  };

  const handleLogin = async () => {
    const cleanIdRaw = sanitizeText(id);
    const cleanPw = normalizePw(pw);

    if (!cleanIdRaw || !cleanPw) return alert(texts.needIdPw);

    const cleanId = normalizeId(cleanIdRaw);

    // ✅ admin/game bypass (App.jsx에서 비번 확인)
    if (cleanId === "admin" || cleanId === "game") {
      onLogin(cleanId, cleanPw);
      return;
    }

    // local first
    const localUser = users.find(
      (u) => normalizeId(u?.id) === cleanId && passOf(u) === cleanPw
    );
    if (localUser) {
      onLogin(cleanId, cleanPw);
      return;
    }

    // then Firestore users
    try {
      const userRef = doc(db, "users", cleanId);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();
        if (passOf(userData) === cleanPw) {
          setUsers((prev) => [...prev, userData]);
          onLogin(cleanId, cleanPw);
        } else {
          alert(texts.wrongPw);
        }
      } else {
        alert(texts.idNotFound);
      }
    } catch (e) {
      console.error("Login check error:", e);
      alert("Error checking login.");
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      mode === "login" ? handleLogin() : signup();
    }
  };

  return (
    <div style={{ ...styles.landingWrapper, minHeight: "100dvh" }}>
      <div
        style={{
          ...styles.bgWrap,
          minHeight: "100dvh",
          position: "absolute",
          inset: 0,
          overflow: "hidden",
        }}
      >
        <div style={styles.bgOverlay} />

        {hero?.mode === "image" && hero?.imageSrc && (
          <img
            src={hero.imageSrc}
            alt=""
            draggable={false}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100dvh",
              objectFit: "cover",
              zIndex: -1,
            }}
          />
        )}

        {hero?.mode === "video" && videoURL && (
          <video
            key={videoURL}
            src={videoURL}
            autoPlay
            muted
            loop
            playsInline
            style={{ ...styles.bgVideo, height: "100dvh", objectFit: "cover" }}
          />
        )}
      </div>

      <div
        style={{
          ...styles.logoContainer,
          left: `${logoPos?.x ?? 0}px`,
          top: `${logoPos?.y ?? 0}px`,
          transition: "all 0.3s ease",
        }}
      >
        {logo ? (
          <img
            src={logo}
            alt="logo"
            style={{
              height: `${logoSize}px`,
              width: "auto",
              objectFit: "contain",
              filter: "drop-shadow(0 0 15px rgba(0,0,0,0.5))",
            }}
          />
        ) : (
          <strong style={styles.defaultLogo}>DAISY</strong>
        )}
      </div>

      <div style={styles.mainContent}>
        <div style={styles.heroSection}>
          <h1 style={styles.mainTitle}>{hero?.title?.[lang] ?? "DAISY"}</h1>
          <p style={styles.subTitle}>{hero?.desc?.[lang] ?? ""}</p>
        </div>

        {!isAdmin && (
          <div style={styles.authWrap}>
            <div style={{ ...styles.authCard, padding: "50px 40px" }}>
              <h2
                style={{
                  ...styles.authTitle,
                  fontSize: "28px",
                  marginBottom: "35px",
                }}
              >
                {mode === "login" ? t.login : t.signup}
              </h2>

              <input
                style={{
                  ...styles.authInput,
                  height: "60px",
                  fontSize: "18px",
                  marginBottom: "20px",
                }}
                placeholder={t.id}
                value={id}
                onChange={(e) => setId(e.target.value)}
                onKeyDown={handleKeyDown}
                autoCapitalize="none"
                autoCorrect="off"
              />

              <input
                type="password"
                style={{
                  ...styles.authInput,
                  height: "60px",
                  fontSize: "18px",
                  marginBottom: "20px",
                }}
                placeholder={t.pw}
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                onKeyDown={handleKeyDown}
              />

              {mode === "signup" && (
                <input
                  style={{
                    ...styles.authInput,
                    height: "60px",
                    fontSize: "18px",
                    marginBottom: "20px",
                    border: "2px solid #ffb347",
                    background: "rgba(255,179,71,0.05)",
                  }}
                  placeholder={texts.enterInvite}
                  value={ref}
                  onChange={(e) => setRef(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
              )}

              <button
                style={{
                  ...styles.primaryBtn,
                  height: "65px",
                  fontSize: "20px",
                  fontWeight: "900",
                  marginTop: "10px",
                }}
                onClick={() => (mode === "login" ? handleLogin() : signup())}
              >
                {mode === "login" ? t.login : t.signup}
              </button>

              {mode === "login" && (
                <button
                  style={{
                    ...styles.guestBtn,
                    height: "55px",
                    marginTop: "15px",
                  }}
                  onClick={onGuestLogin}
                >
                  {t.guest}
                </button>
              )}

              <div
                style={{
                  ...styles.authToggle,
                  fontSize: "15px",
                  marginTop: "30px",
                }}
                onClick={() => {
                  setMode(mode === "login" ? "signup" : "login");
                  setId("");
                  setPw("");
                  setRef("");
                }}
              >
                {mode === "login" ? texts.newHere : texts.haveAccount}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
