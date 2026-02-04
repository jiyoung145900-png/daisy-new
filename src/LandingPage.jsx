import { useState, useMemo } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

/* =================================================================
   LANDING PAGE (怨듬갚 ?쒓굅 + DB 吏곹넻 ?뺤씤 + admin/game ?뱀닔 濡쒓렇??吏??
   - 湲곗〈 湲곕뒫 ?좎?
   - admin / game 濡쒓렇??"議댁옱?섏? ?딅뒗 ?꾩씠?? 諛⑹?
   - pw/password ?쇱슜 諛⑹뼱
   - 蹂듬텤 ?쒕줈??怨듬갚 諛⑹뼱
================================================================= */

// ???좏떥: ?쒕줈??怨듬갚/?댁긽臾몄옄 ?쒓굅 + trim
const sanitizeText = (s) =>
  String(s ?? "")
    .replace(/\u200B/g, "") // zero-width space
    .replace(/\uFEFF/g, "") // BOM
    .trim();

// ??ID??鍮꾧탳?⑹쑝濡쒕쭔 ?뚮Ц???듭씪 (?꾩슂 ?놁쑝硫?.toLowerCase() ?쒓굅 媛??
const normalizeId = (s) => sanitizeText(s).toLowerCase();

// ??鍮꾨쾲? 洹몃?濡?trim留?
const normalizePw = (s) => sanitizeText(s);

// ???좎? 媛앹껜?먯꽌 鍮꾨쾲 異붿텧 (pw/password ?????덉슜)
const passOf = (u) => String(u?.password ?? u?.pw ?? "");

// ??媛??????λ룄 pw/password ?????ｌ뼱???명솚
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
      fillAll: isKo ? "紐⑤뱺 ?뺣낫瑜??낅젰?댁＜?몄슂." : "Please fill all info.",
      idExists: isKo ? "?대? 議댁옱?섎뒗 ?꾩씠?붿엯?덈떎." : "ID already exists.",
      invalidInvite: isKo ? "議댁옱?섏? ?딅뒗 珥덈? 肄붾뱶?낅땲??" : "Invalid referral code.",
      needIdPw: isKo ? "?꾩씠?붿? 鍮꾨쾲???낅젰?섏꽭??" : "Enter ID & PW.",
      wrongPw: isKo ? "鍮꾨?踰덊샇媛 ??몄뒿?덈떎." : "Wrong Password.",
      idNotFound: isKo ? "議댁옱?섏? ?딅뒗 ?꾩씠?붿엯?덈떎." : "ID not found.",
      signupOk: isKo ? "?깃났?곸쑝濡?媛?낅릺?덉뒿?덈떎! 濡쒓렇?명빐二쇱꽭??" : "Signup Success! Please Login.",
    }),
    [isKo]
  );

  /* =====================
       1) ?뚯썝媛??(湲곗〈 湲곕뒫 ?좎? + ?명솚 媛뺥솕)
  ===================== */
  const signup = async () => {
    const cleanIdRaw = sanitizeText(id);
    const cleanPw = normalizePw(pw);
    const cleanRef = sanitizeText(ref);

    // ???낅젰 ?뺤씤
    if (!cleanIdRaw || !cleanPw || !cleanRef) {
      return alert(texts.fillAll);
    }

    // ??ID 鍮꾧탳??normalize(?뚮Ц?? ?쒕줈???쒓굅) 湲곗?
    const cleanId = normalizeId(cleanIdRaw);

    // ??濡쒖뺄 以묐났 ?뺤씤 (pw/password ?쇱슜 怨좊젮 X, id留?泥댄겕)
    if (users.find((u) => normalizeId(u.id) === cleanId)) {
      return alert(texts.idExists);
    }

    let agentName = "";
    let isValidRef = false;

    // ??珥덈? 肄붾뱶 寃利?(湲곗〈 ?좎?)
    if (cleanRef === "ADMIN") {
      isValidRef = true;
      agentName = "ADMIN";
    } else {
      // 1) 濡쒖뺄 users?먯꽌 珥덈?肄붾뱶濡?李얘린(湲곗〈 ?좎?)
      const userRef = users.find((u) => u.id === cleanRef);
      if (userRef) {
        isValidRef = true;
        agentName = userRef.id;
      } else {
        // 2) Firestore invite_codes?먯꽌 李얘린(湲곗〈 ?좎?)
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
          console.error("DB ?먮윭:", error);
          return alert(`Error: ${error.message}`);
        }
      }
    }

    if (!isValidRef) return;

    // ???좎? ?앹꽦 (湲곗〈 ?꾨뱶 ?좎? + password??媛숈씠 ??ν빐???명솚)
    const startNo = 2783982189;
    const generatedNo = (startNo + users.length).toString();

    const newUser = {
      id: cleanId, // ??id??normalize??媛믪쑝濡?????먮옒?濡???ν븯怨??띠쑝硫?cleanIdRaw濡?諛붽퓭????
      ...buildUserPasswordFields(cleanPw), // pw + password 紐⑤몢 ???
      no: generatedNo,
      referral: cleanRef,
      diamond: 0,
      refCode: cleanId, // 湲곗〈 ?좎?
      agentName,
      joinedAt: new Date().toISOString(),
    };

    const updatedUsers = [...users, newUser];
    setUsers(updatedUsers);

    if (syncToFirebase) {
      // ?좑툘 ?ш린??settings/global??users瑜??듭㎏濡??ｋ뒗 援ъ“硫?undefined ?쒓굅 ?꾩슂?????덉쓬.
      // 湲곗〈 湲곕뒫 ?좎? 李⑥썝?먯꽌 洹몃?濡??몄텧
      await syncToFirebase({ users: updatedUsers });
    }

    alert(texts.signupOk);
    setId("");
    setPw("");
    setRef("");
    setMode("login");
  };

  /* =====================
       2) 濡쒓렇??(admin/game 利됱떆 ?듦낵 + pw/password ?명솚)
  ===================== */
  const handleLogin = async () => {
    const cleanIdRaw = sanitizeText(id);
    const cleanPw = normalizePw(pw);

    if (!cleanIdRaw || !cleanPw) {
      return alert(texts.needIdPw);
    }

    const cleanId = normalizeId(cleanIdRaw);

    // ??[?듭떖] admin/game? Landing?먯꽌 DB 議고쉶?섏? 留먭퀬 App?쇰줈 諛붾줈 ?섍?
    if (cleanId === "admin" || cleanId === "game") {
      onLogin(cleanId, cleanPw);
      return;
    }

    // 1?④퀎: 濡쒖뺄 users 諛곗뿴 癒쇱? ?뺤씤 (鍮좊Ⅸ 濡쒓렇??
    const localUser = users.find(
      (u) => normalizeId(u.id) === cleanId && passOf(u) === cleanPw
    );
    if (localUser) {
      onLogin(cleanId, cleanPw);
      return;
    }

    // 2?④퀎: Firestore users 而щ젆??吏곸젒 ?뺤씤
    try {
      const docRef = doc(db, "users", cleanId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const userData = docSnap.data();

        if (passOf(userData) === cleanPw) {
          // ??濡쒖뺄 users?먮룄 異붽?(湲곗〈 湲곕뒫 ?좎?)
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
      console.error("濡쒓렇???뺤씤 以??먮윭:", error);
      alert("Error checking login.");
    }
  };

  // ???뷀꽣???숈옉 ?좎?
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
                  placeholder={"Enter Invitation Code"}
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
                    ? "泥섏쓬?댁떊媛?? ?뚯썝媛??
                    : "New here? Sign Up"
                  : isKo
                  ? "?대? 怨꾩젙???덈굹?? 濡쒓렇??
                  : "Have an account? Login"}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}



