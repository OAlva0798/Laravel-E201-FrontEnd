import React, {
    useState,
    useEffect,
    useCallback,
} from "react";

import FileCrudManager from "../../inc/components/FileCrudManager";
import UserDetailsForm from "./UserDetailsForm";

import { showErrorAlert } from "../../../assets/js/swalHelpers";
import { API_BASE_URL } from "../../../assets/js/appConfig";

const EMPTY_FORM = {
    ud_uniqid: "",
    ud_avatar: "",
    ud_firstname: "",
    ud_middlename: "",
    ud_lastname: "",
    ud_email: "",
    ud_center_reference: "",
    ud_department_reference: "",
    ud_position_reference: "",
    ud_center_head: "No",
    ud_is_approver: "No",
    ud_status: "Active",
};

export default function UserDetailsContent() {

    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    // =========================================================
    // FETCH USER DETAILS
    // =========================================================

    const fetchItems = useCallback(async () => {
        try {
            setLoading(true);

            const res = await fetch(
                `${API_BASE_URL}/user-details`,
                {
                    headers: {
                        Accept: "application/json",
                    },
                }
            );

            if (!res.ok) {
                throw new Error(
                    "Failed to fetch user details."
                );
            }

            const result = await res.json();

            const data = Array.isArray(result)
                ? result
                : result.data || [];

            const formattedData = data.map(
                (item) => ({
                    ...item,

                    center_name:
                        item.center?.mc_name ||
                        item.center_name ||
                        "—",

                    department_name:
                        item.department?.md_name ||
                        item.department_name ||
                        "—",

                    position_name:
                        item.position?.mp_name ||
                        item.position_name ||
                        "—",

                    full_name: [
                        item.ud_firstname,
                        item.ud_middlename,
                        item.ud_lastname,
                    ]
                        .filter(Boolean)
                        .join(" ")
                        .trim() || "—",
                })
            );

            setItems(formattedData);

        } catch (err) {
            console.error(err);

            showErrorAlert(
                err.message ||
                    "Error fetching user details."
            );
        } finally {
            setLoading(false);
        }
    }, []);

    // =========================================================
    // INITIAL LOAD
    // =========================================================

    useEffect(() => {
        fetchItems();
    }, [fetchItems]);

    // =========================================================
    // TABLE COLUMNS
    // =========================================================

    const getColumns = (
        handleOpenModal,
        handleDelete,
        toggleStatus
    ) => [
        {
            header: "Unique ID",
            accessor: "ud_uniqid",
            className: "w-[10%]",
            cellClassName:
                "font-bold text-slate-900",
        },

        {
            header: "Name",
            accessor: "full_name",
            className: "w-[25%]",
            cellClassName:
                "font-semibold text-slate-800",
        },

        {
            header: "Email",
            accessor: "ud_email",
            className: "w-[20%]",
            cellClassName:
                "text-slate-600 font-medium",
        },

        {
            header: "Position",
            accessor: "position_name",
            className: "w-[20%]",
            cellClassName:
                "text-slate-600",
        },

        {
            header: "Status",
            accessor: "ud_status",
            className:
                "text-center w-[5%]",
            cellClassName:
                "text-center px-3",

            render: (row) => (
                <span
                    onClick={() =>
                        toggleStatus(
                            row.ud_uniqid
                        )
                    }
                    title="Click to toggle"
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold cursor-pointer border transition-all hover:scale-105 ${
                        row.ud_status ===
                        "Active"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-rose-50 text-rose-700 border-rose-200"
                    }`}
                >
                    <span
                        className={`w-2 h-2 rounded-full ${
                            row.ud_status ===
                            "Active"
                                ? "bg-emerald-500 animate-pulse"
                                : "bg-rose-500"
                        }`}
                    />

                    {row.ud_status}
                </span>
            ),
        },

        {
            header: "Actions",
            sortable: false,
            className:
                "text-center w-[10%]",
            cellClassName:
                "text-center px-3",

            render: (row) => (
                <div className="flex items-center justify-center gap-2">

                    <button
                        type="button"
                        onClick={() =>
                            handleOpenModal(row)
                        }
                        className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition font-semibold cursor-pointer text-[11px]"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-4">
                        <path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32l8.4-8.4Z" />
                        <path d="M5.25 5.25a3 3 0 0 0-3 3v10.5a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3V13.5a.75.75 0 0 0-1.5 0v5.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5V8.25a1.5 1.5 0 0 1 1.5-1.5h5.25a.75.75 0 0 0 0-1.5H5.25Z" />
                        </svg>
                    </button>

                    <button
                        type="button"
                        onClick={() =>
                            handleDelete(
                                row.ud_uniqid
                            )
                        }
                        className="px-3 py-1.5 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition font-semibold cursor-pointer text-[11px]"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m19 7l-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v3M4 7h16" />
                        </svg>
                    </button>

                </div>
            ),
        },
    ];

    // =========================================================
    // RENDER
    // =========================================================

    return (
        <FileCrudManager
            apiEndpoint={`${API_BASE_URL}/user-details`}
            emailDispatchEndpoint={`${API_BASE_URL}/email-dispatch`}
            primaryKey="ud_uniqid"
            statusKey="ud_status"
            title="User Details"
            emptyForm={EMPTY_FORM}
            columns={getColumns}
            FormComponent={UserDetailsForm}
            items={items}
            loading={loading}
            onFetchItems={fetchItems}
            modalSize="4xl"
        />
    );
}