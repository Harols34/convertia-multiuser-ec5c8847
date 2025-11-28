"use client";

import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";

interface DisplayCardProps {
    className?: string;
    icon?: React.ReactNode;
    title?: string;
    description?: string;
    date?: string;
    iconClassName?: string;
    titleClassName?: string;
}

function DisplayCard({
    className,
    icon = <Sparkles className="size-4 text-blue-300" />,
    title = "Featured",
    description = "Discover amazing content",
    date = "Just now",
    iconClassName = "text-blue-500",
    titleClassName = "text-blue-500",
}: DisplayCardProps) {
    return (
        <div
            className={cn(
                "relative flex h-48 w-[34rem] -skew-y-[8deg] select-none flex-col justify-between rounded-xl border-2 bg-white backdrop-blur-sm px-6 py-5 transition-all duration-700 after:absolute after:-right-1 after:top-[-5%] after:h-[110%] after:w-[32rem] after:bg-gradient-to-l after:from-background after:to-transparent after:content-[''] hover:border-white/20 [&>*]:flex [&>*]:items-center [&>*]:gap-2",
                className
            )}
        >
            <div>
                <span className="relative inline-block rounded-full bg-emerald-700 p-1.5">
                    {icon}
                </span>
                <p className={cn("text-xl font-bold", titleClassName)}>{title}</p>
            </div>
            <p className="text-lg font-medium text-slate-800">{description}</p>
            <p className="text-base font-semibold text-slate-600">{date}</p>
        </div>
    );
}

interface DisplayCardsProps {
    cards?: DisplayCardProps[];
    className?: string;
}

export default function DisplayCards({ cards, className }: DisplayCardsProps) {
    const defaultCards = [
        {
            className: "[grid-area:stack] hover:-translate-y-10",
        },
        {
            className: "[grid-area:stack] translate-x-16 translate-y-10 hover:-translate-y-1",
        },
        {
            className: "[grid-area:stack] translate-x-32 translate-y-20 hover:translate-y-10",
        },
    ];

    const displayCards = cards || defaultCards;

    return (
        <div className={cn("grid [grid-template-areas:'stack'] place-items-center opacity-100 animate-in fade-in-0 duration-700", className)}>
            {displayCards.map((cardProps, index) => (
                <DisplayCard key={index} {...cardProps} />
            ))}
        </div>
    );
}
