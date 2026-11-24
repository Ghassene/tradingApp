import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { RateChart } from "./src/RateChart";
import { fmt, fmtDate, getRates, PAIR_INFO, PAIRS, type Currency, type DayRates, type Pair } from "./src/rates";

const C = {
  bg: "#0c1222",
  card: "#131b2e",
  cardActive: "#18223a",
  border: "#22304a",
  text: "#f1f5f9",
  muted: "#94a3b8",
  faint: "#64748b",
  gold: "#f5b942",
  up: "#34d399",
  down: "#fb7185",
};

const PERIODS = [7, 30, 90] as const;
const CURRENCIES: Currency[] = ["CHF", "EUR", "TND"];
const NAMES: Record<Currency, string> = { CHF: "Franc suisse", EUR: "Euro", TND: "Dinar tunisien" };

function Change({ pct, suffix }: { pct: number; suffix: string }) {
  const up = pct >= 0;
  return (
    <Text style={styles.small}>
      <Text style={{ color: up ? C.up : C.down, fontWeight: "600" }}>
        {up ? "▲" : "▼"} {fmt(Math.abs(pct), 2)} %
      </Text>
      <Text style={{ color: C.faint }}> {suffix}</Text>
    </Text>
  );
}

function Converter({ latest }: { latest: DayRates }) {
  const [amount, setAmount] = useState("100");
  const [from, setFrom] = useState<Currency>("CHF");
  const n = Number(amount.replace(",", ".")) || 0;
  const perChf: Record<Currency, number> = { CHF: 1, EUR: latest["CHF-EUR"], TND: latest["CHF-TND"] };
  const chf = n / perChf[from];

  return (
    <View style={styles.card}>
      <Text style={styles.h2}>Convertisseur</Text>
      <View style={styles.segment}>
        {CURRENCIES.map((c) => (
          <Pressable key={c} onPress={() => setFrom(c)} style={[styles.segBtn, from === c && styles.segBtnOn]}>
            <Text style={[styles.segText, from === c && styles.segTextOn]}>{c}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        style={styles.input}
        placeholder="Montant"
        placeholderTextColor={C.faint}
        accessibilityLabel={`Montant en ${from}`}
      />
      {CURRENCIES.filter((c) => c !== from).map((c) => (
        <View key={c} style={styles.convRow}>
          <Text style={{ color: C.muted }}>{NAMES[c]}</Text>
          <Text style={styles.convValue}>
            {fmt(chf * perChf[c], c === "TND" ? 3 : 2)} <Text style={{ color: C.faint, fontSize: 13 }}>{c}</Text>
          </Text>
        </View>
      ))}
    </View>
  );
}

function Home() {
  const [data, setData] = useState<{ latest: DayRates; history: DayRates[] } | null>(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pair, setPair] = useState<Pair>("CHF-EUR");
  const [days, setDays] = useState<number>(30);

  const load = useCallback(async () => {
    try {
      setError(false);
      setData(await getRates(90));
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => data?.history.slice(-days) ?? [], [data, days]);

  if (!data) {
    return (
      <View style={styles.center}>
        {error ? (
          <>
            <Text style={styles.h2}>Taux indisponibles</Text>
            <Text style={[styles.small, { color: C.muted, marginTop: 8 }]}>Vérifiez votre connexion.</Text>
            <Pressable onPress={load} style={[styles.segBtn, styles.segBtnOn, { marginTop: 16, paddingHorizontal: 20 }]}>
              <Text style={styles.segTextOn}>Réessayer</Text>
            </Pressable>
          </>
        ) : (
          <ActivityIndicator color={C.gold} size="large" />
        )}
      </View>
    );
  }

  const { latest, history } = data;
  const prev = history[history.length - 2];
  const first = visible[0]?.[pair] ?? latest[pair];
  const periodPct = ((latest[pair] - first) / first) * 100;

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          tintColor={C.gold}
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }
    >
      <Text style={styles.kicker}>CHF · EUR · TND</Text>
      <Text style={styles.h1}>Taux de change</Text>
      <Text style={[styles.small, { color: C.muted, marginTop: 4 }]}>Taux du {fmtDate(latest.date, true)}</Text>

      <View style={{ gap: 10, marginTop: 20 }}>
        {PAIRS.map((p) => {
          const info = PAIR_INFO[p];
          const day = prev ? ((latest[p] - prev[p]) / prev[p]) * 100 : 0;
          const active = p === pair;
          return (
            <Pressable
              key={p}
              onPress={() => setPair(p)}
              style={[styles.pairCard, active && { backgroundColor: C.cardActive, borderColor: info.color }]}
            >
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={[styles.dot, { backgroundColor: info.color }]} />
                  <Text style={styles.pairName}>
                    {info.base} / {info.quote}
                  </Text>
                </View>
                <Text style={[styles.small, { color: C.faint, marginTop: 4 }]}>{info.label}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.rate}>{fmt(latest[p])}</Text>
                <Change pct={day} suffix="1 j" />
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.card, { marginTop: 16 }]}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View>
            <Text style={styles.h2}>
              {PAIR_INFO[pair].base} / {PAIR_INFO[pair].quote}
            </Text>
            <Change pct={periodPct} suffix={`sur ${days} jours`} />
          </View>
          <View style={styles.segment}>
            {PERIODS.map((d) => (
              <Pressable key={d} onPress={() => setDays(d)} style={[styles.segBtn, days === d && styles.segBtnOn]}>
                <Text style={[styles.segText, days === d && styles.segTextOn]}>{d} j</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <View style={{ marginTop: 12 }}>
          <RateChart data={visible} pair={pair} />
        </View>
      </View>

      <View style={{ marginTop: 16 }}>
        <Converter latest={latest} />
      </View>

      <Text style={styles.footer}>
        Données réelles quotidiennes (currency-api). Taux moyens indicatifs, sans marge bancaire. Tirez vers le bas
        pour actualiser.
      </Text>
    </ScrollView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <StatusBar style="light" />
        <Home />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.bg, padding: 24 },
  kicker: { color: C.gold, fontSize: 12, fontWeight: "700", letterSpacing: 2.5 },
  h1: { color: C.text, fontSize: 30, fontWeight: "700", marginTop: 6 },
  h2: { color: C.text, fontSize: 17, fontWeight: "600" },
  small: { fontSize: 12 },
  card: { backgroundColor: C.card, borderColor: C.border, borderWidth: 1, borderRadius: 18, padding: 16 },
  pairCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.card,
    borderColor: C.border,
    borderWidth: 1.5,
    borderRadius: 18,
    padding: 16,
  },
  dot: { width: 9, height: 9, borderRadius: 5 },
  pairName: { color: C.text, fontSize: 16, fontWeight: "600" },
  rate: { color: C.text, fontSize: 24, fontWeight: "600", fontVariant: ["tabular-nums"], marginBottom: 2 },
  segment: { flexDirection: "row", backgroundColor: C.bg, borderRadius: 12, padding: 3, alignSelf: "flex-start" },
  segBtn: { paddingVertical: 6, paddingHorizontal: 11, borderRadius: 9 },
  segBtnOn: { backgroundColor: C.gold },
  segText: { color: C.muted, fontSize: 13 },
  segTextOn: { color: "#0f172a", fontWeight: "700", fontSize: 13 },
  input: {
    marginTop: 12,
    backgroundColor: C.bg,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: C.text,
    fontSize: 22,
    fontVariant: ["tabular-nums"],
  },
  convRow: {
    marginTop: 10,
    backgroundColor: C.bg,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  convValue: { color: C.text, fontSize: 19, fontWeight: "600", fontVariant: ["tabular-nums"] },
  footer: { color: C.faint, fontSize: 11, marginTop: 20, lineHeight: 16 },
});
