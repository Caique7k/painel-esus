"use client"

import Image from "next/image"
import { useEffect, useState } from "react"

export default function Home() {

  // ===============================
  // STATES
  // ===============================

  // Horário atual (HH:MM)
  const [time, setTime] = useState("")

  // Data atual (DD/MM/AAAA)
  const [date, setDate] = useState("")

  // ===============================
  // EFFECT - Atualiza hora e data
  // ===============================

  useEffect(() => {

    // Função responsável por atualizar hora e data
    const updateDateTime = () => {
      const now = new Date()

      // Hora
      const hours = now.getHours().toString().padStart(2, "0")
      const minutes = now.getMinutes().toString().padStart(2, "0")

      // Data
      const day = now.getDate().toString().padStart(2, "0")
      const month = (now.getMonth() + 1).toString().padStart(2, "0")
      const year = now.getFullYear()

      setTime(`${hours}:${minutes}`)
      setDate(`${day}/${month}/${year}`)
    }

    // Atualiza imediatamente ao carregar
    updateDateTime();

    // Atualiza a cada 1 segundo
    const interval = setInterval(updateDateTime, 1000)

    // Limpa o intervalo ao desmontar o componente
    return () => clearInterval(interval)

  }, [])

  return (
    // ===============================
    // LAYOUT PRINCIPAL
    // ===============================
    <div className="h-screen relative overflow-hidden bg-slate-900">

      {/* ================= HEADER ================= */}
      <div className="h-[20%] min-h-30 bg-blue-900 text-white z-10 relative flex items-center px-8 gap-6 shadow-xl">

        {/* LOGO */}
        <div className="h-[70%] aspect-square relative">
          <Image
            src="/e-sus-logo.png"
            alt="Logo do hospital"
            fill
            className="object-contain"
          />
        </div>

        {/* NOME DO HOSPITAL */}
        <div className=" text-base sm:text-lg md:text-3xl font-semibold leading-tight max-w-[70%]">
          Hospital Municipal Regional de Atendimento Integrado de *Cidade*
        </div>

        {/* RELÓGIO */}
        <div className="ml-auto bg-blue-950/80 px-5 py-3 rounded-lg text-center border border-blue-800/50">

          {/* HORA */}
          <div className="text-lg sm:text-xl md:text-2xl font-semibold leading-none font-mono">
            {time}
          </div>

          {/* DATA */}
          <div className="text-sm sm:text-base md:text-xl opacity-80">
            {date}
          </div>
        </div>
      </div>

      {/* ================= MAIN ================= */}
      <div className="relative h-[55%] overflow-hidden">

        {/* BACKGROUND LAYERS */}
        <div className="absolute inset-0 z-0 pointer-events-none">

          {/* AZUL BASE (50%) */}
          <div className="absolute inset-0 bg-blue-600"
            style={{
              clipPath: "polygon(100% 100%, 100% 0%, 35% 0%, 50% 100%)"
            }}
          />

          {/* AZUL MÉDIO (25%) */}
          <div className="absolute inset-0 bg-blue-700"
           style={{
            clipPath: "polygon(50.1% 100%, 35.1% 0%, 15% 0%, 30% 100%)"
           }}
          />

          {/* AZUL ESCURO (25%) */}
          <div className="absolute inset-0 bg-blue-800"
            style={{
              clipPath: "polygon(30.1% 100%, 15.1% 0%, 0% 0%, 0% 100%)"
            }}
          />
        </div>

        {/* MÉDICO – FIXO NO TOPO ESQUERDO */}
        <div className="absolute top-1 left-1 sm:top-2 sm:left-2 md:top-4 md:left-4 z-20">
          <div className="inline-block bg-white/10 backdrop-blur-md px-3 py-1.5 sm:px-4 sm:py-2 md:py-3 rounded-lg border-l-4 border-blue-400 shadow-lg max-w-[75w] sm:max-w-none">
            <p className="text-blue-200 text-[10px] sm:text-xs uppercase tracking-widest font-bold">
              Médico(a)
            </p>
            <p className="text-white text-sm sm:text-base md:text-xl font-semibold truncate">
              Dr. Nome do Profissional
            </p>
          </div>
        </div>

        {/* CONTEÚDO CENTRAL */}
        <div className="relative z-10 w-full h-full flex flex-col items-center justify-center p-8 text-center">

          {/* TÍTULO - PACIENTE */}
          <p className="text-blue-200 text-xl md:text-2xl uppercase tracking-[0.2em] mb-2 font-medium">
            Paciente
          </p>

          <h1 className="text-3xl md:text-5xl lg:text-6xl font-black text-white uppercase drop-shadow-lg tracking-wide animate-pulse-once">
            Nome do Paciente
          </h1>

          {/* SALA */}
          <div className="mt-2 md:mt-4 px-8 py-2 bg-blue-950/30 backdrop-blur-sm rounded-full border border-blue-400/20">
            <p className="text-xl md:text-3xl font-medium text-blue-100">
              Sala 01
            </p>
          </div>
        </div>
      </div>

      {/* ================= FOOTER ================= */}
      <div className="absolute bottom-0 w-full h-[30%] bg-blue-200/90 text-blue-900 z-20 backdrop-blur-md shadow-[0_-10px_40px_rgba(0,0,0,0.1)] flex flex-col">

        {/* TÍTULO */}
        <div className="px-4 py-2 bg-blue-100/80 border-b border-blue-300">
          <span className="text-lg md:text-2xl font-semibold uppercase tracking-wide text-blue-900">
            Últimas chamadas
          </span>
        </div>

        {/* ÁREA DAS CHAMADAS */}
        <div className="flex-1 px-2 pb-10">
          {/* Grid restaurado para manter colunas horizontais e items-center para centralizar no vácuo do F11 */}
          <div className="grid grid-cols-[2fr_auto_2fr_auto_2fr] h-full items-center">

            {/* COLUNA 1 */}
            <div className="flex flex-col gap-1 md:gap-2 pl-2">
              <p className="text-[2.5vh] lg:text-[3vh] font-medium leading-tight">
                00:00 — Paciente
              </p>
              <p className="text-[2.5vh] lg:text-[3vh] font-medium leading-tight">
                00:00 — Paciente
              </p>
              <p className="text-[2.5vh] lg:text-[3vh] font-medium leading-tight">
                00:00 — Paciente
              </p>
            </div>
          </div>
        </div>

        {/* LINHA / LETREIRO */}
        <div className="absolute bottom-0 left-0 w-full h-10 bg-blue-500" />
      </div>
    </div>
  );
}
