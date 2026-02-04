import { useState, useMemo } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

/* =================================================================
   LANDING PAGE (Í≥µÎ∞± ?úÍ±∞ + DB ÏßÅÌÜµ ?ïÏù∏ + admin/game ?πÏàò Î°úÍ∑∏??ÏßÄ??
   - Í∏∞Ï°¥ Í∏∞Îä• ?†Ï?
   - admin / game Î°úÍ∑∏??"Ï°¥Ïû¨?òÏ? ?äÎäî ?ÑÏù¥?? Î∞©Ï?
   - pw/password ?ºÏö© Î∞©Ïñ¥
   - Î≥µÎ∂ô ?úÎ°ú??Í≥µÎ∞± Î∞©Ïñ¥
================================================================= */

// ???†Ìã∏: ?úÎ°ú??Í≥µÎ∞±/?¥ÏÉÅÎ¨∏Ïûê ?úÍ±∞ + trim
const sanitizeText = (s) =>
  String(s ?? "")
    .replace(/\u200B/g, "") // zero-width space
    .replace(/\uFEFF/g, "") // BOM
    .trim();

// ??ID??ÎπÑÍµê?©ÏúºÎ°úÎßå ?åÎ¨∏???µÏùº (?ÑÏöî ?ÜÏúºÎ©?.toLowerCase() ?úÍ±∞ Í∞Ä??
const normalizeId = (s) => sanitizeText(s).toLowerCase();

// ??ÎπÑÎ≤à?Ä Í∑∏Î?Î°?trimÎß?
const normalizePw = (s) => sanitizeText(s);

// ???†Ï? Í∞ùÏ≤¥?êÏÑú ÎπÑÎ≤à Ï∂îÏ∂ú (pw/password ?????àÏö©)
const passOf = (u) => String(u?.password ?? u?.pw ?? "");

// ??Í∞Ä?????Ä?•ÎèÑ pw/password ?????£Ïñ¥???∏Ìôò
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
  const [mode, setMode] = useState("login");
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [ref, setRef] = useState("");

  const isKo = lang === "ko";

  const texts = useMemo(
    () => ({
      fillAll: isKo ? "Î™®Îì† ?ïÎ≥¥Î•??ÖÎ†•?¥Ï£º?∏Ïöî." : "Please fill all info.",
      idExists: isKo ? "?¥Î? Ï°¥Ïû¨?òÎäî ?ÑÏù¥?îÏûÖ?àÎã§." : "ID already exists.",
      invalidInvite: isKo ? "Ï°¥Ïû¨?òÏ? ?äÎäî Ï¥àÎ? ÏΩîÎìú?ÖÎãà??" : "Invalid referral code.",
      needIdPw: isKo ? "?ÑÏù¥?îÏ? ÎπÑÎ≤à???ÖÎ†•?òÏÑ∏??" : "Enter ID & PW.",
      wrongPw: isKo ? "ÎπÑÎ?Î≤àÌò∏Í∞Ä ?Ä?∏Ïäµ?àÎã§." : "Wrong Password.",
      idNotFound: isKo ? "Ï°¥Ïû¨?òÏ? ?äÎäî ?ÑÏù¥?îÏûÖ?àÎã§." : "ID not found.",
      signupOk: isKo ? "?±Í≥µ?ÅÏúºÎ°?Í∞Ä?ÖÎêò?àÏäµ?àÎã§! Î°úÍ∑∏?∏Ìï¥Ï£ºÏÑ∏??" : "Signup Success! Please Login.",
    }),
    [isKo]
  );

  /* =====================
       1) ?åÏõêÍ∞Ä??(Í∏∞Ï°¥ Í∏∞Îä• ?†Ï? + ?∏Ìôò Í∞ïÌôî)
  ===================== */
  const signup = async () => {
    const cleanIdRaw = sanitizeText(id);
    const cleanPw = normalizePw(pw);
    const cleanRef = sanitizeText(ref);

    // ???ÖÎ†• ?ïÏù∏
    if (!cleanIdRaw || !cleanPw || !cleanRef) {
      return alert(texts.fillAll);
    }

    // ??ID ÎπÑÍµê??normalize(?åÎ¨∏?? ?úÎ°ú???úÍ±∞) Í∏∞Ï?
    const cleanId = normalizeId(cleanIdRaw);

    // ??Î°úÏª¨ Ï§ëÎ≥µ ?ïÏù∏ (pw/password ?ºÏö© Í≥†Î†§ X, idÎß?Ï≤¥ÌÅ¨)
    if (users.find((u) => normalizeId(u.id) === cleanId)) {
      return alert(texts.idExists);
    }

    let agentName = "";
    let isValidRef = false;

    // ??Ï¥àÎ? ÏΩîÎìú Í≤ÄÏ¶?(Í∏∞Ï°¥ ?†Ï?)
    if (cleanRef === "ADMIN") {
      isValidRef = true;
      agentName = "ADMIN";
    } else {
      // 1) Î°úÏª¨ users?êÏÑú Ï¥àÎ?ÏΩîÎìúÎ°?Ï∞æÍ∏∞(Í∏∞Ï°¥ ?†Ï?)
      const userRef = users.find((u) => u.id === cleanRef);
      if (userRef) {
        isValidRef = true;
        agentName = userRef.id;
      } else {
        // 2) Firestore invite_codes?êÏÑú Ï∞æÍ∏∞(Í∏∞Ï°¥ ?†Ï?)
        try {
          const docRef = doc(db, "invite_codes", cleanRef);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            isValidRef = true;
            agentName = docSnap.data()?.name ?? "";
          } else {
            return alert(texts.invalidInvite);
          }
        } catch (error) {
          console.error("DB ?êÎü¨:", error);
          return alert(`Error: ${error.message}`);
        }
      }
    }

    if (!isValidRef) return;

    // ???†Ï? ?ùÏÑ± (Í∏∞Ï°¥ ?ÑÎìú ?†Ï? + password??Í∞ôÏù¥ ?Ä?•Ìï¥???∏Ìôò)
    const startNo = 2783982189;
    const generatedNo = (startNo + users.length).toString();

    const newUser = {
      id: cleanId, // ??id??normalize??Í∞íÏúºÎ°??Ä???êÎûò?ÄÎ°??Ä?•ÌïòÍ≥??∂ÏúºÎ©?cleanIdRawÎ°?Î∞îÍøî????
      ...buildUserPasswordFields(cleanPw), // pw + password Î™®Îëê ?Ä??
      no: generatedNo,
      referral: cleanRef,
      diamond: 0,
      refCode: cleanId, // Í∏∞Ï°¥ ?†Ï?
      agentName,
      joinedAt: new Date().toISOString(),
    };

    const updatedUsers = [...users, newUser];
    setUsers(updatedUsers);

    if (syncToFirebase) {
      // ?†Ô∏è ?¨Í∏∞??settings/global??usersÎ•??µÏß∏Î°??£Îäî Íµ¨Ï°∞Î©?undefined ?úÍ±∞ ?ÑÏöî?????àÏùå.
      // Í∏∞Ï°¥ Í∏∞Îä• ?†Ï? Ï∞®Ïõê?êÏÑú Í∑∏Î?Î°??∏Ï∂ú
      await syncToFirebase({ users: updatedUsers });
    }

    alert(texts.signupOk);
    setId("");
    setPw("");
    setRef("");
    setMode("login");
  };

  /* =====================
       2) Î°úÍ∑∏??(admin/game Ï¶âÏãú ?µÍ≥º + pw/password ?∏Ìôò)
  ===================== */
  const handleLogin = async () => {
    const cleanIdRaw = sanitizeText(id);
    const cleanPw = normalizePw(pw);

    if (!cleanIdRaw || !cleanPw) {
      return alert(texts.needIdPw);
    }

    const cleanId = normalizeId(cleanIdRaw);

    // ??[?µÏã¨] admin/game?Ä Landing?êÏÑú DB Ï°∞Ìöå?òÏ? ÎßêÍ≥† App?ºÎ°ú Î∞îÎ°ú ?òÍ?
    if (cleanId === "admin" || cleanId === "game") {
      onLogin(cleanId, cleanPw);
      return;
    }

    // 1?®Í≥Ñ: Î°úÏª¨ users Î∞∞Ïó¥ Î®ºÏ? ?ïÏù∏ (Îπ†Î•∏ Î°úÍ∑∏??
    const localUser = users.find(
      (u) => normalizeId(u.id) === cleanId && passOf(u) === cleanPw
    );
    if (localUser) {
      onLogin(cleanId, cleanPw);
      return;
    }

    // 2?®Í≥Ñ: Firestore users Ïª¨Î†â??ÏßÅÏ†ë ?ïÏù∏
    try {
      const docRef = doc(db, "users", cleanId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const userData = docSnap.data();

        if (passOf(userData) === cleanPw) {
          // ??Î°úÏª¨ users?êÎèÑ Ï∂îÍ?(Í∏∞Ï°¥ Í∏∞Îä• ?†Ï?)
          const newUsersList = [...users, userData];
          setUsers(newUsersList);

          onLogin(cleanId, cleanPw);
        } else {
          alert(texts.wrongPw);
        }
      } else {
        alert(texts.idNotFound);
      }
    } catch (error) {
      console.error("Î°úÍ∑∏???ïÏù∏ Ï§??êÎü¨:", error);
      alert("Error checking login.");
    }
  };

  // ???îÌÑ∞???ôÏûë ?†Ï?
  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      mode === "login" ? handleLogin() : signup();
    }
  };

  return (
    <div
      style={{
        ...styles.landingWrapper,
        minHeight: "100dvh",
      }}
    >
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
        {hero.mode === "image" && hero.imageSrc && (
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
        {hero.mode === "video" && videoURL && (
          <video
            key={videoURL}
            src={videoURL}
            autoPlay
            muted
            loop
            playsInline
            style={{
              ...styles.bgVideo,
              height: "100dvh",
              objectFit: "cover",
            }}
          />
        )}
      </div>

      <div
        style={{
          ...styles.logoContainer,
          left: `${logoPos.x}px`,
          top: `${logoPos.y}px`,
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
          <h1 style={styles.mainTitle}>{hero.title[lang]}</h1>
          <p style={styles.subTitle}>{hero.desc[lang]}</p>
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
                  placeholder={isKo ? "Ï¥àÎ? ÏΩîÎìúÎ•??ÖÎ†•?òÏÑ∏?? : "Enter Invitation Code"}
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
                  style={{ ...styles.guestBtn, height: "55px", marginTop: "15px" }}
                  onClick={onGuestLogin}
                >
                  {t.guest}
                </button>
              )}

              <div
                style={{ ...styles.authToggle, fontSize: "15px", marginTop: "30px" }}
                onClick={() => {
                  setMode(mode === "login" ? "signup" : "login");
                  setId("");
                  setPw("");
                  setRef("");
                }}
              >
                {mode === "login"
                  ? isKo
                    ? "Ï≤òÏùå?¥Ïã†Í∞Ä?? ?åÏõêÍ∞Ä??
                    : "New here? Sign Up"
                  : isKo
                  ? "?¥Î? Í≥ÑÏ†ï???àÎÇò?? Î°úÍ∑∏??
                  : "Have an account? Login"}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
