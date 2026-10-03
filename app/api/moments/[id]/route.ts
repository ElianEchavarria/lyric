import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// DELETE /api/moments/<id> — remove one of the signed-in user's moments.
export async function DELETE(
    _request: Request,
    // Next.js 15+ hands dynamic route params over as a Promise.
    { params }: { params: Promise<{ id: string }> },
) {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return new Response("Unauthorized", { status: 401 });

    const { id } = await params;

    try {
        // Filtering on userId as well as id is what keeps this private: someone
        // else's moment simply doesn't match, so it can't be deleted from here.
        const { count } = await db.moment.deleteMany({ where: { id, userId } });
        if (count === 0) return Response.json({ error: "Not found" }, { status: 404 });
        return new Response(null, { status: 204 });
    } catch (error) {
        console.error("Failed to delete moment:", error);
        return Response.json({ error: "Failed to delete moment" }, { status: 500 });
    }
}
