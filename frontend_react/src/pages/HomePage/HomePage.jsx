import React from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import { countryFlags } from "../../shared/i18n";

// главная страница: фильтры + кнопка начать чат
export default function HomePage() {
  const nav = useNavigate();
  const {
    dict,
    language,
    antiBullying,
    setAntiBullying,
    geoEnabled,
    setGeoEnabled,
    filterEnabled,
    setFilterEnabled,
    selectedCountryIndex,
    setSelectedCountryIndex,
    filters,
    setFilters,
  } = useApp();

  const t = (key) => dict[key] || key;
  const countries = dict.countries || [];

  const handlePillClick = (groupKey, value) => {
    setFilters((prev) => ({ ...prev, [groupKey]: value }));
  };

  // лог + переход на поиск
  const handleStartChat = () => {
    const selectedCountry =
      geoEnabled && selectedCountryIndex != null
        ? countries[selectedCountryIndex]
        : null;

    const payload = {
      language,
      antiBullying,
      geoEnabled,
      selectedCountry,
      filterEnabled,
      filters,
    };

    console.log("Параметры чата:", payload);
    nav("/searching");
  };

  return (
    <main className="content-card page-enter home-page">
      <p className="tagline">{t("tagline")}</p>

      {/* скроллируемый контейнер настроек и фильтров */}
      <div className="home-scrollable">
        {/* блок переключателей */}
        <section className="settings">
          {/* анти-буллинг */}
          <div className="setting-row">
            <div className="setting-row__text">
              <span className="setting-label">{t("anti_bullying")}</span>
              <span className="info-icon-wrapper">
                <span className="info-icon">ⓘ</span>
                <div className="tooltip">
                  {t("anti_bullying_tooltip")}
                </div>
              </span>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={antiBullying}
                onChange={(e) => setAntiBullying(e.target.checked)}
              />
              <span className="switch-slider" />
            </label>
          </div>

        {/* гео */}
        <div className="setting-row">
          <div className="setting-row__text">
            <span className="setting-label">{t("geo_search")}</span>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={geoEnabled}
              onChange={(e) => {
                const next = e.target.checked;
                setGeoEnabled(next);
                if (!next) setSelectedCountryIndex(null);
              }}
            />
            <span className="switch-slider" />
          </label>
        </div>

        {/* страна (модалка открывается через AppShell по событию) */}
        {geoEnabled && (
          <div className="setting-row setting-row--country">
            <div className="setting-row__text">
              <span className="setting-label">{t("country_label")}</span>
            </div>
            <button
              type="button"
              className="pill pill--country"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                // открываем модалку страны через кастомное событие
                window.dispatchEvent(new CustomEvent("sidetalk:open-country"));
              }}
            >
              {selectedCountryIndex != null && countries[selectedCountryIndex] && (
                <>
                  {countryFlags[countries[selectedCountryIndex]] && (
                    <img
                      src={countryFlags[countries[selectedCountryIndex]]}
                      alt=""
                      className="country-flag-icon"
                    />
                  )}
                  <span>
                    {countries[selectedCountryIndex]}
                  </span>
                </>
              )}
              {selectedCountryIndex == null && (
                <span>
                  {t("choose_country")}
                </span>
              )}
            </button>
          </div>
        )}

        {/* фильтрация */}
        <div className="setting-row">
          <div className="setting-row__text">
            <span className="setting-label">{t("filter_label")}</span>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={filterEnabled}
              onChange={(e) => setFilterEnabled(e.target.checked)}
            />
            <span className="switch-slider" />
          </label>
        </div>
      </section>

      {/* фильтры или лес */}
      <section className="filters-wrapper">
        {filterEnabled ? (
          <div className="filters-container">
            {/* мой возраст */}
            <div className="filters-group">
              <p className="filter-title">{t("my_age")}</p>
              <div className="pill-row">
                <button
                  className={
                    "pill pill--selectable" +
                    (filters.myAge === "18–25" ? " pill--active" : "")
                  }
                  onClick={() => handlePillClick("myAge", "18–25")}
                >
                  {t("age_18_25")}
                </button>
                <button
                  className={
                    "pill pill--selectable" +
                    (filters.myAge === "25+" ? " pill--active" : "")
                  }
                  onClick={() => handlePillClick("myAge", "25+")}
                >
                  {t("age_25_plus")}
                </button>
              </div>
              <div className="pill-row">
                <button
                  className={
                    "pill pill--selectable" +
                    (filters.myAge === "any" ? " pill--active" : "")
                  }
                  onClick={() => handlePillClick("myAge", "any")}
                >
                  {t("any")}
                </button>
              </div>
            </div>

            {/* мой пол */}
            <div className="filters-group">
              <p className="filter-title">{t("my_gender")}</p>
              <div className="pill-column">
                <button
                  className={
                    "pill pill--selectable" +
                    (filters.myGender === "female" ? " pill--active" : "")
                  }
                  onClick={() => handlePillClick("myGender", "female")}
                >
                  {t("female")}
                </button>
                <button
                  className={
                    "pill pill--selectable" +
                    (filters.myGender === "male" ? " pill--active" : "")
                  }
                  onClick={() => handlePillClick("myGender", "male")}
                >
                  {t("male")}
                </button>
                <button
                  className={
                    "pill pill--selectable" +
                    (filters.myGender === "any" ? " pill--active" : "")
                  }
                  onClick={() => handlePillClick("myGender", "any")}
                >
                  {t("any")}
                </button>
              </div>
            </div>

            {/* возраст собеседника */}
            <div className="filters-group">
              <p className="filter-title">{t("peer_age")}</p>
              <div className="pill-row">
                <button
                  className={
                    "pill pill--selectable" +
                    (filters.peerAge === "18–25" ? " pill--active" : "")
                  }
                  onClick={() => handlePillClick("peerAge", "18–25")}
                >
                  {t("age_18_25")}
                </button>
                <button
                  className={
                    "pill pill--selectable" +
                    (filters.peerAge === "25+" ? " pill--active" : "")
                  }
                  onClick={() => handlePillClick("peerAge", "25+")}
                >
                  {t("age_25_plus")}
                </button>
              </div>
              <div className="pill-row">
                <button
                  className={
                    "pill pill--selectable" +
                    (filters.peerAge === "any" ? " pill--active" : "")
                  }
                  onClick={() => handlePillClick("peerAge", "any")}
                >
                  {t("any")}
                </button>
              </div>
            </div>

            {/* пол собеседника */}
            <div className="filters-group">
              <p className="filter-title">{t("peer_gender")}</p>
              <div className="pill-column">
                <button
                  className={
                    "pill pill--selectable" +
                    (filters.peerGender === "female" ? " pill--active" : "")
                  }
                  onClick={() => handlePillClick("peerGender", "female")}
                >
                  {t("female")}
                </button>
                <button
                  className={
                    "pill pill--selectable" +
                    (filters.peerGender === "male" ? " pill--active" : "")
                  }
                  onClick={() => handlePillClick("peerGender", "male")}
                >
                  {t("male")}
                </button>
                <button
                  className={
                    "pill pill--selectable" +
                    (filters.peerGender === "any" ? " pill--active" : "")
                  }
                  onClick={() => handlePillClick("peerGender", "any")}
                >
                  {t("any")}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="vibe-container">
            <div className="vibe-scene" aria-hidden="true">
              {/* Floating geometric shapes */}
              <div className="vibe-shape vibe-shape--circle vibe-shape--1" />
              <div className="vibe-shape vibe-shape--circle vibe-shape--2" />
              <div className="vibe-shape vibe-shape--square vibe-shape--3" />
              <div className="vibe-shape vibe-shape--triangle vibe-shape--4" />
              <div className="vibe-shape vibe-shape--circle vibe-shape--5" />

              {/* Central emoji/icon */}
              <div className="vibe-emoji">
                <span className="vibe-emoji__icon">✨</span>
                <div className="vibe-emoji__ring vibe-emoji__ring--1" />
                <div className="vibe-emoji__ring vibe-emoji__ring--2" />
              </div>

              {/* Floating particles */}
              <div className="vibe-particle vibe-particle--1">💫</div>
              <div className="vibe-particle vibe-particle--2">🌟</div>
              <div className="vibe-particle vibe-particle--3">⭐</div>
              <div className="vibe-particle vibe-particle--4">✨</div>
            </div>
            <p className="vibe-text">{t("relax_text")}</p>
            <p className="vibe-subtext">{language === "ru" ? "случайный собеседник ждёт тебя" : "a random chat partner awaits"}</p>
          </div>
        )}
      </section>
      </div>
      {/* конец скроллируемого контейнера */}

      <div className="home-bottom">
        <button type="button" className="primary-btn" onClick={handleStartChat}>
          {t("start_chat")}
        </button>
      </div>
    </main>
  );
}
