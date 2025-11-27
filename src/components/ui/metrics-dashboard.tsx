"use client";

import { motion, useAnimation } from "framer-motion";
import { TrendingUp, Users, Building2, Award, DollarSign, Activity } from "lucide-react";
import { useEffect, useState } from "react";

interface MetricData {
    icon: React.ReactNode;
    label: string;
    value: number;
    suffix?: string;
    prefix?: string;
    color: string;
    gradient: string;
}

function AnimatedCounter({ value, prefix = "", suffix = "" }: { value: number; prefix?: string; suffix?: string }) {
    const [displayValue, setDisplayValue] = useState(0);

    useEffect(() => {
        const duration = 2000;
        const steps = 60;
        const increment = value / steps;
        let current = 0;

        const timer = setInterval(() => {
            current += increment;
            if (current >= value) {
                setDisplayValue(value);
                clearInterval(timer);
            } else {
                setDisplayValue(Math.floor(current));
            }
        }, duration / steps);

        return () => clearInterval(timer);
    }, [value]);

    return (
        <span className="font-bold text-3xl">
            {prefix}{displayValue.toLocaleString()}{suffix}
        </span>
    );
}

function LiveMetricBar({ data, index }: { data: MetricData; index: number }) {
    const [progress, setProgress] = useState(0);
    const [value, setValue] = useState(data.value);
    const controls = useAnimation();

    useEffect(() => {
        // Animate progress bar
        const progressTimer = setInterval(() => {
            setProgress((prev) => {
                const next = prev + Math.random() * 10 - 5;
                return Math.max(60, Math.min(100, next));
            });
        }, 2000);

        // Animate value changes
        const valueTimer = setInterval(() => {
            setValue((prev) => {
                const change = Math.floor(Math.random() * 20) - 10;
                return prev + change;
            });
        }, 3000);

        // Pulse animation
        controls.start({
            scale: [1, 1.02, 1],
            transition: { duration: 2, repeat: Infinity, ease: "easeInOut" }
        });

        return () => {
            clearInterval(progressTimer);
            clearInterval(valueTimer);
        };
    }, [controls]);

    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="relative overflow-hidden"
        >
            <div className="relative bg-white/90 backdrop-blur-md rounded-2xl p-6 border-2 border-white/50 shadow-lg">
                {/* Animated gradient background */}
                <motion.div
                    className="absolute inset-0 opacity-10"
                    style={{
                        background: data.gradient,
                    }}
                    animate={{
                        backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
                    }}
                    transition={{
                        duration: 5,
                        repeat: Infinity,
                        ease: "linear",
                    }}
                />

                <div className="relative z-10">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <motion.div
                                animate={controls}
                                className={`p-3 rounded-xl ${data.color}`}
                            >
                                <div className="text-white">{data.icon}</div>
                            </motion.div>
                            <div>
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    {data.label}
                                </p>
                                <motion.div
                                    key={value}
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="text-slate-900"
                                >
                                    <AnimatedCounter value={value} prefix={data.prefix} suffix={data.suffix} />
                                </motion.div>
                            </div>
                        </div>

                        <motion.div
                            animate={{
                                rotate: [0, 5, -5, 0],
                            }}
                            transition={{
                                duration: 3,
                                repeat: Infinity,
                                ease: "easeInOut",
                            }}
                        >
                            <TrendingUp className="h-6 w-6 text-emerald-600" />
                        </motion.div>
                    </div>

                    {/* Animated progress bar */}
                    <div className="relative h-2 bg-slate-200 rounded-full overflow-hidden">
                        <motion.div
                            className={`absolute inset-y-0 left-0 rounded-full ${data.color}`}
                            initial={{ width: "0%" }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.5, ease: "easeOut" }}
                        />

                        {/* Shimmer effect */}
                        <motion.div
                            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                            animate={{
                                x: ["-100%", "200%"],
                            }}
                            transition={{
                                duration: 2,
                                repeat: Infinity,
                                ease: "linear",
                            }}
                        />
                    </div>

                    {/* Live indicator */}
                    <div className="flex items-center gap-2 mt-3">
                        <motion.div
                            className="w-2 h-2 rounded-full bg-emerald-500"
                            animate={{
                                opacity: [1, 0.3, 1],
                                scale: [1, 1.2, 1],
                            }}
                            transition={{
                                duration: 2,
                                repeat: Infinity,
                                ease: "easeInOut",
                            }}
                        />
                        <span className="text-xs font-medium text-slate-600">Live</span>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

export function MetricsDashboard() {
    const [metrics, setMetrics] = useState<MetricData[]>([
        {
            icon: <Users className="h-6 w-6" />,
            label: "Usuarios Activos",
            value: 1247,
            color: "bg-gradient-to-br from-emerald-500 to-emerald-600",
            gradient: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
        },
        {
            icon: <Building2 className="h-6 w-6" />,
            label: "Empresas",
            value: 43,
            color: "bg-gradient-to-br from-teal-500 to-teal-600",
            gradient: "linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)",
        },
        {
            icon: <Award className="h-6 w-6" />,
            label: "Referidos Activos",
            value: 892,
            color: "bg-gradient-to-br from-green-500 to-green-600",
            gradient: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
        },
        {
            icon: <DollarSign className="h-6 w-6" />,
            label: "Bonos del Mes",
            value: 24500,
            prefix: "$",
            color: "bg-gradient-to-br from-emerald-600 to-teal-600",
            gradient: "linear-gradient(135deg, #059669 0%, #0d9488 100%)",
        },
        {
            icon: <Activity className="h-6 w-6" />,
            label: "Tasa Actividad",
            value: 94,
            suffix: "%",
            color: "bg-gradient-to-br from-teal-600 to-green-600",
            gradient: "linear-gradient(135deg, #0d9488 0%, #16a34a 100%)",
        },
        {
            icon: <TrendingUp className="h-6 w-6" />,
            label: "Crecimiento Mensual",
            value: 18,
            prefix: "+",
            suffix: "%",
            color: "bg-gradient-to-br from-green-600 to-emerald-600",
            gradient: "linear-gradient(135deg, #16a34a 0%, #059669 100%)",
        },
    ]);

    return (
        <div className="w-full">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 flex items-center justify-between"
            >
                <div>
                    <h3 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600">
                        Dashboard BI en Tiempo Real
                    </h3>
                    <p className="text-slate-600 font-medium mt-1">Métricas actualizándose constantemente</p>
                </div>

                <motion.div
                    animate={{
                        rotate: [0, 360],
                    }}
                    transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: "linear",
                    }}
                    className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg"
                >
                    <Activity className="h-6 w-6 text-white" />
                </motion.div>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {metrics.map((metric, index) => (
                    <LiveMetricBar key={index} data={metric} index={index} />
                ))}
            </div>
        </div>
    );
}
